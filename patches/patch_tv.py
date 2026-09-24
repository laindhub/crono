from pathlib import Path
import json
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch_tv.py <decompiled-dir> <agenda-js>")

root = Path(sys.argv[1])
agenda_js_path = Path(sys.argv[2])
main = root / "smali/com/angulismotv/MainActivity.smali"
agenda_client = root / "smali/com/angulismotv/fragments/AgendaFragment$setupWebView$2.smali"
apktool_yml = root / "apktool.yml"

for p in (main, agenda_client, agenda_js_path, apktool_yml):
    if not p.exists():
        raise SystemExit(f"missing required file: {p}")

# ---------------------------------------------------------------------------
# TV agenda: replace the old small fullscreen-only page-finished injection
# with a complete D-pad-first agenda implementation. It is gated by pathname,
# so transmission pages keep the original fullscreen behaviour.
# ---------------------------------------------------------------------------
js = agenda_js_path.read_text(encoding="utf-8").strip()
client = agenda_client.read_text(encoding="utf-8")
lines = client.splitlines()

matches = [
    i for i, line in enumerate(lines)
    if 'const-string p2, "javascript:' in line and "document.getElementById" in line and "fullscreen" in line
]
if len(matches) != 1:
    raise SystemExit(f"expected exactly one fullscreen JS injection, found {len(matches)}")

idx = matches[0]
indent = lines[idx][:len(lines[idx]) - len(lines[idx].lstrip())]
lines[idx] = indent + "const-string p2, " + json.dumps("javascript:" + js, ensure_ascii=True)
client = "\n".join(lines) + "\n"

# Give the TV page a deterministic way to hand focus back to the native
# navigation rail when DPAD_LEFT is pressed on an event.
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
if needle not in client:
    raise SystemExit("agenda URL override insertion point not found")
client = client.replace(needle, insert, 1)
agenda_client.write_text(client, encoding="utf-8")

# ---------------------------------------------------------------------------
# Sidebar: expanded means every label is visible; collapsed means every label
# is GONE before the rail shrinks. This prevents clipped vertical fragments of
# the selected label and restores labels for non-selected entries.
# ---------------------------------------------------------------------------
s = main.read_text(encoding="utf-8")

helper = r'''
.method private final setSideMenuLabelsVisible(Z)V
    .locals 3

    if-eqz p1, :tv_labels_hide

    const/4 v0, 0x0

    goto :tv_labels_apply

    :tv_labels_hide
    const/16 v0, 0x8

    :tv_labels_apply
    sget v1, Lcom/angulismotv/R$id;->menu_channels_text:I

    invoke-virtual {p0, v1}, Lcom/angulismotv/MainActivity;->findViewById(I)Landroid/view/View;

    move-result-object v2

    if-eqz v2, :tv_label_agenda

    invoke-virtual {v2, v0}, Landroid/view/View;->setVisibility(I)V

    :tv_label_agenda
    sget v1, Lcom/angulismotv/R$id;->menu_agenda_text:I

    invoke-virtual {p0, v1}, Lcom/angulismotv/MainActivity;->findViewById(I)Landroid/view/View;

    move-result-object v2

    if-eqz v2, :tv_label_multicam

    invoke-virtual {v2, v0}, Landroid/view/View;->setVisibility(I)V

    :tv_label_multicam
    sget v1, Lcom/angulismotv/R$id;->menu_multicam_text:I

    invoke-virtual {p0, v1}, Lcom/angulismotv/MainActivity;->findViewById(I)Landroid/view/View;

    move-result-object v2

    if-eqz v2, :tv_label_forum

    invoke-virtual {v2, v0}, Landroid/view/View;->setVisibility(I)V

    :tv_label_forum
    sget v1, Lcom/angulismotv/R$id;->menu_forum_text:I

    invoke-virtual {p0, v1}, Lcom/angulismotv/MainActivity;->findViewById(I)Landroid/view/View;

    move-result-object v2

    if-eqz v2, :tv_labels_done

    invoke-virtual {v2, v0}, Landroid/view/View;->setVisibility(I)V

    :tv_labels_done
    return-void
.end method

'''

setup_marker = ".method private final setupSideMenuItem(Landroid/widget/LinearLayout;Landroid/widget/TextView;I)V"
if "setSideMenuLabelsVisible(Z)V" not in s:
    if setup_marker not in s:
        raise SystemExit("setupSideMenuItem marker not found")
    s = s.replace(setup_marker, helper + setup_marker, 1)

collapse_head = """.method private final collapseSideMenu(Z)V
    .locals 4
"""
collapse_new = """.method private final collapseSideMenu(Z)V
    .locals 4

    const/4 v0, 0x0

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->setSideMenuLabelsVisible(Z)V
"""
if collapse_head not in s:
    raise SystemExit("collapseSideMenu header not found")
s = s.replace(collapse_head, collapse_new, 1)

expand_head = """.method private final expandSideMenu()V
    .locals 4
"""
expand_new = """.method private final expandSideMenu()V
    .locals 4

    const/4 v0, 0x1

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->setSideMenuLabelsVisible(Z)V
"""
if expand_head not in s:
    raise SystemExit("expandSideMenu header not found")
s = s.replace(expand_head, expand_new, 1)

pattern = re.compile(
    r"\.method private static final setupSideMenuItem\$lambda\$6\(Lcom/angulismotv/MainActivity;Landroid/widget/TextView;Landroid/view/View;Z\)V\n.*?\.end method",
    re.S,
)
replacement = r'''.method private static final setupSideMenuItem$lambda$6(Lcom/angulismotv/MainActivity;Landroid/widget/TextView;Landroid/view/View;Z)V
    .locals 1

    if-eqz p3, :tv_focus_lost

    invoke-direct {p0}, Lcom/angulismotv/MainActivity;->expandSideMenu()V

    return-void

    :tv_focus_lost
    invoke-direct {p0}, Lcom/angulismotv/MainActivity;->anySideMenuItemFocused()Z

    move-result v0

    if-nez v0, :tv_focus_done

    const/4 v0, 0x1

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->collapseSideMenu(Z)V

    :tv_focus_done
    return-void
.end method'''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f"expected one side menu focus lambda, replaced {count}")

main.write_text(s, encoding="utf-8")

# Version the test build separately from the previous audio-only patch.
yml = apktool_yml.read_text(encoding="utf-8")
yml = re.sub(r"versionCode: '[0-9]+'", "versionCode: '105'", yml)
yml = re.sub(r"versionName: .*", "versionName: 1.3-tvfix", yml)
apktool_yml.write_text(yml, encoding="utf-8")

# Fail closed if any important patch is missing.
checks = {
    agenda_client: ["__ANGULISMO_TV_AGENDA__", "angulismo://focus-menu", "menu_agenda"],
    main: ["setSideMenuLabelsVisible(Z)V", ":tv_labels_hide", ":tv_focus_lost"],
}
for path, tokens in checks.items():
    data = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in data:
            raise SystemExit(f"verification failed: {token} missing from {path}")

print("TV agenda and sidebar patches applied successfully")
