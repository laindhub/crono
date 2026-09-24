from pathlib import Path
import json
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch_agenda_only.py <decompiled-dir> <agenda-js>")

root = Path(sys.argv[1])
agenda_js_path = Path(sys.argv[2])
fragment = root / "smali/com/angulismotv/fragments/AgendaFragment.smali"
client = root / "smali/com/angulismotv/fragments/AgendaFragment$setupWebView$2.smali"

for p in (fragment, client, agenda_js_path):
    if not p.exists():
        raise SystemExit(f"missing required file: {p}")

# Fix the stale domain in the original APK. Without this, current
# angulismotv.pages.dev transmission URLs are treated as blocked popups.
fs = fragment.read_text(encoding="utf-8")
old_domain = 'const-string v0, "angulismotv-dnh.pages.dev"'
new_domain = 'const-string v0, "angulismotv.pages.dev"'
if fs.count(old_domain) != 1:
    raise SystemExit(f"expected one stale agenda domain, found {fs.count(old_domain)}")
fs = fs.replace(old_domain, new_domain, 1)

# Ensure the WebView itself receives remote key events immediately.
start = fs.index(".method private final loadAgenda()V")
end = fs.index(".end method", start)
method = fs[start:end]
old_load = '''    invoke-virtual {v1, v0}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    return-void
'''
new_load = '''    invoke-virtual {v1, v0}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-virtual {v1}, Landroid/view/View;->requestFocus()Z

    return-void
'''
if old_load not in method:
    raise SystemExit("loadAgenda focus insertion point not found")
method = method.replace(old_load, new_load, 1)
fs = fs[:start] + method + fs[end:]
fragment.write_text(fs, encoding="utf-8")

# Replace the original tiny page-finished patch with the complete D-pad-first
# agenda UI. The JS is path-gated: on transmission pages it leaves the page
# intact and only preserves the original fullscreen bridge.
js = agenda_js_path.read_text(encoding="utf-8").strip()
cs = client.read_text(encoding="utf-8")
lines = cs.splitlines()
matches = [
    i for i, line in enumerate(lines)
    if 'const-string p2, "javascript:' in line
    and "document.getElementById" in line
    and "fullscreen" in line
]
if len(matches) != 1:
    raise SystemExit(f"expected exactly one agenda JS injection, found {len(matches)}")
idx = matches[0]
indent = lines[idx][:len(lines[idx]) - len(lines[idx].lstrip())]
lines[idx] = indent + "const-string p2, " + json.dumps("javascript:" + js, ensure_ascii=True)
cs = "\n".join(lines) + "\n"

# Private navigation URI used only by the injected agenda. When the user is on
# the left edge and presses DPAD_LEFT, focus returns to the native Agenda item.
needle = '''    .line 143
    :cond_0
    iget-object v1, p0, Lcom/angulismotv/fragments/AgendaFragment$setupWebView$2;->this$0:Lcom/angulismotv/fragments/AgendaFragment;
'''
insert = '''    .line 143
    :cond_0
    const-string v1, "angulismo://focus-menu"

    invoke-virtual {p2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v1

    if-eqz v1, :tv_menu_continue

    iget-object v1, p0, Lcom/angulismotv/fragments/AgendaFragment$setupWebView$2;->this$0:Lcom/angulismotv/fragments/AgendaFragment;

    invoke-virtual {v1}, Lcom/angulismotv/fragments/AgendaFragment;->getActivity()Landroidx/fragment/app/FragmentActivity;

    move-result-object v1

    if-eqz v1, :tv_menu_return

    sget v2, Lcom/angulismotv/R$id;->menu_agenda:I

    invoke-virtual {v1, v2}, Landroid/app/Activity;->findViewById(I)Landroid/view/View;

    move-result-object v1

    if-eqz v1, :tv_menu_return

    invoke-virtual {v1}, Landroid/view/View;->requestFocus()Z

    :tv_menu_return
    return v0

    :tv_menu_continue
    iget-object v1, p0, Lcom/angulismotv/fragments/AgendaFragment$setupWebView$2;->this$0:Lcom/angulismotv/fragments/AgendaFragment;
'''
if needle not in cs:
    raise SystemExit("focus-menu interception insertion point not found")
cs = cs.replace(needle, insert, 1)
client.write_text(cs, encoding="utf-8")

checks = {
    fragment: ["angulismotv.pages.dev", "requestFocus()Z"],
    client: ["__ANGULISMO_TV_AGENDA__", "angulismo://focus-menu", "menu_agenda"],
}
for path, tokens in checks.items():
    data = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in data:
            raise SystemExit(f"verification failed: {token} missing from {path}")

print("TV agenda patch applied successfully")
