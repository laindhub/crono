from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_sidebar.py <decompiled-dir>")

root = Path(sys.argv[1])
main = root / "smali/com/angulismotv/MainActivity.smali"
if not main.exists():
    raise SystemExit(f"missing {main}")

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
if "setSideMenuLabelsVisible(Z)V" in s:
    raise SystemExit("sidebar patch already present; refusing double patch")
if setup_marker not in s:
    raise SystemExit("setupSideMenuItem marker not found")
s = s.replace(setup_marker, helper + setup_marker, 1)

collapse_head = """.method private final collapseSideMenu(Z)V
    .locals 4
"""
collapse_new = """.method private final collapseSideMenu(Z)V
    .locals 4

    # Hide every label before shrinking the rail. This avoids clipped letters.
    const/4 v0, 0x0

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->setSideMenuLabelsVisible(Z)V
"""
if s.count(collapse_head) != 1:
    raise SystemExit(f"expected one collapseSideMenu header, found {s.count(collapse_head)}")
s = s.replace(collapse_head, collapse_new, 1)

expand_head = """.method private final expandSideMenu()V
    .locals 4
"""
expand_new = """.method private final expandSideMenu()V
    .locals 4

    # Expanded rail always shows all labels, not only the focused item.
    const/4 v0, 0x1

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->setSideMenuLabelsVisible(Z)V
"""
if s.count(expand_head) != 1:
    raise SystemExit(f"expected one expandSideMenu header, found {s.count(expand_head)}")
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

for token in (
    "setSideMenuLabelsVisible(Z)V",
    "menu_channels_text",
    "menu_agenda_text",
    "menu_multicam_text",
    "menu_forum_text",
    ":tv_focus_lost",
):
    if token not in s:
        raise SystemExit(f"verification failed: missing {token}")

main.write_text(s, encoding="utf-8")
print("Sidebar TV focus/label patch applied")
