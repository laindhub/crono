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

labels_helper = r'''
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

dpad_helper = r'''
.method private final handleSideMenuKey(I)Z
    .locals 5

    invoke-direct {p0}, Lcom/angulismotv/MainActivity;->anySideMenuItemFocused()Z
    move-result v0
    if-nez v0, :tv_menu_has_focus

    const/4 v0, 0x0
    return v0

    :tv_menu_has_focus
    invoke-virtual {p0}, Lcom/angulismotv/MainActivity;->getCurrentFocus()Landroid/view/View;
    move-result-object v0
    if-eqz v0, :tv_menu_not_handled

    invoke-virtual {v0}, Landroid/view/View;->getId()I
    move-result v1

    # DPAD_UP
    const/16 v2, 0x13
    if-ne p1, v2, :tv_menu_check_down

    sget v2, Lcom/angulismotv/R$id;->menu_agenda:I
    if-ne v1, v2, :tv_menu_up_from_multicam
    sget v3, Lcom/angulismotv/R$id;->menu_channels:I
    goto :tv_menu_request

    :tv_menu_up_from_multicam
    sget v2, Lcom/angulismotv/R$id;->menu_multicam:I
    if-ne v1, v2, :tv_menu_up_from_forum
    sget v3, Lcom/angulismotv/R$id;->menu_agenda:I
    goto :tv_menu_request

    :tv_menu_up_from_forum
    sget v2, Lcom/angulismotv/R$id;->menu_forum:I
    if-ne v1, v2, :tv_menu_consume
    sget v3, Lcom/angulismotv/R$id;->menu_multicam:I
    goto :tv_menu_request

    # DPAD_DOWN
    :tv_menu_check_down
    const/16 v2, 0x14
    if-ne p1, v2, :tv_menu_check_left

    sget v2, Lcom/angulismotv/R$id;->menu_channels:I
    if-ne v1, v2, :tv_menu_down_from_agenda
    sget v3, Lcom/angulismotv/R$id;->menu_agenda:I
    goto :tv_menu_request

    :tv_menu_down_from_agenda
    sget v2, Lcom/angulismotv/R$id;->menu_agenda:I
    if-ne v1, v2, :tv_menu_down_from_multicam
    sget v3, Lcom/angulismotv/R$id;->menu_multicam:I
    goto :tv_menu_request

    :tv_menu_down_from_multicam
    sget v2, Lcom/angulismotv/R$id;->menu_multicam:I
    if-ne v1, v2, :tv_menu_consume
    sget v3, Lcom/angulismotv/R$id;->menu_forum:I
    goto :tv_menu_request

    # DPAD_LEFT: stay in the rail.
    :tv_menu_check_left
    const/16 v2, 0x15
    if-ne p1, v2, :tv_menu_check_right
    goto :tv_menu_consume

    # DPAD_RIGHT: restore the active section highlight, collapse the rail,
    # then let Android transfer focus to the content.
    :tv_menu_check_right
    const/16 v2, 0x16
    if-ne p1, v2, :tv_menu_check_center

    iget v2, p0, Lcom/angulismotv/MainActivity;->currentNavId:I
    invoke-direct {p0, v2}, Lcom/angulismotv/MainActivity;->updateSideMenuSelection(I)V

    const/4 v2, 0x1
    invoke-direct {p0, v2}, Lcom/angulismotv/MainActivity;->collapseSideMenu(Z)V
    const/4 v0, 0x0
    return v0

    # DPAD_CENTER / ENTER: click the focused menu item explicitly.
    :tv_menu_check_center
    const/16 v2, 0x17
    if-ne p1, v2, :tv_menu_check_enter
    invoke-virtual {v0}, Landroid/view/View;->performClick()Z
    goto :tv_menu_consume

    :tv_menu_check_enter
    const/16 v2, 0x42
    if-ne p1, v2, :tv_menu_not_handled
    invoke-virtual {v0}, Landroid/view/View;->performClick()Z
    goto :tv_menu_consume

    :tv_menu_request
    invoke-virtual {p0, v3}, Lcom/angulismotv/MainActivity;->findViewById(I)Landroid/view/View;
    move-result-object v4
    if-eqz v4, :tv_menu_consume
    invoke-virtual {v4}, Landroid/view/View;->requestFocus()Z

    :tv_menu_consume
    const/4 v0, 0x1
    return v0

    :tv_menu_not_handled
    const/4 v0, 0x0
    return v0
.end method

'''

setup_marker = ".method private final setupSideMenuItem(Landroid/widget/LinearLayout;Landroid/widget/TextView;I)V"

if "setSideMenuLabelsVisible(Z)V" in s or "handleSideMenuKey(I)Z" in s:
    raise SystemExit("sidebar patch already present; refusing double patch")
if setup_marker not in s:
    raise SystemExit("setupSideMenuItem marker not found")

s = s.replace(setup_marker, labels_helper + dpad_helper + setup_marker, 1)

collapse_head = """.method private final collapseSideMenu(Z)V
    .locals 4
"""
collapse_new = """.method private final collapseSideMenu(Z)V
    .locals 4

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

    const/4 v0, 0x1
    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->setSideMenuLabelsVisible(Z)V
"""
if s.count(expand_head) != 1:
    raise SystemExit(f"expected one expandSideMenu header, found {s.count(expand_head)}")
s = s.replace(expand_head, expand_new, 1)

focus_pattern = re.compile(
    r"\.method private static final setupSideMenuItem\$lambda\$6\(Lcom/angulismotv/MainActivity;Landroid/widget/TextView;Landroid/view/View;Z\)V\n.*?\.end method",
    re.S,
)
focus_replacement = r'''.method private static final setupSideMenuItem$lambda$6(Lcom/angulismotv/MainActivity;Landroid/widget/TextView;Landroid/view/View;Z)V
    .locals 2

    if-eqz p3, :tv_focus_lost

    invoke-direct {p0}, Lcom/angulismotv/MainActivity;->expandSideMenu()V

    # While the rail owns focus, visual selection follows the focused item
    # instead of the currently open section.
    const/4 v0, 0x0

    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->updateSideMenuSelection(I)V

    sget v1, Lcom/angulismotv/R$drawable;->side_menu_item_bg:I

    invoke-virtual {p2, v1}, Landroid/view/View;->setBackgroundResource(I)V

    :tv_focus_lost
    return-void
.end method'''
s, count = focus_pattern.subn(focus_replacement, s, count=1)
if count != 1:
    raise SystemExit(f"expected one side menu focus lambda, replaced {count}")

dispatch_old = r'''.line 212
    :cond_2
    invoke-super {p0, p1}, Landroidx/appcompat/app/AppCompatActivity;->dispatchKeyEvent(Landroid/view/KeyEvent;)Z

    move-result p1

    return p1
.end method'''

dispatch_new = r'''.line 212
    :cond_2
    invoke-direct {p0, v0}, Lcom/angulismotv/MainActivity;->handleSideMenuKey(I)Z

    move-result v1
    if-eqz v1, :tv_dispatch_super

    const/4 p1, 0x1
    return p1

    :tv_dispatch_super
    invoke-super {p0, p1}, Landroidx/appcompat/app/AppCompatActivity;->dispatchKeyEvent(Landroid/view/KeyEvent;)Z

    move-result p1
    return p1
.end method'''

if dispatch_old not in s:
    raise SystemExit("dispatchKeyEvent patch point not found")
s = s.replace(dispatch_old, dispatch_new, 1)

for token in (
    "setSideMenuLabelsVisible(Z)V",
    "handleSideMenuKey(I)Z",
    ":tv_menu_request",
    ":tv_menu_check_center",
    ":tv_dispatch_super",
    ":tv_focus_lost",
    "side_menu_item_bg",
    "updateSideMenuSelection(I)V",
    "menu_channels_text",
    "menu_agenda_text",
    "menu_multicam_text",
    "menu_forum_text",
):
    if token not in s:
        raise SystemExit(f"verification failed: missing {token}")

main.write_text(s, encoding="utf-8")
print("Sidebar TV focus/label patch applied")
