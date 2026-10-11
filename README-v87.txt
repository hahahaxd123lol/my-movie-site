FLIX2WATCH v87 — PROFILE EDIT MODAL CENTERING

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE
- Older centering rules targeted old modal selectors.
- The real current editor is #v35-profile-modal.f2w-profile-modal.
- The site-wide page fade also applies contain:paint to body, which could trap
  the fixed profile editor near page-content geometry instead of the viewport.

FIX
- Targets the real v35 profile editor.
- Disables body paint containment while Edit Profile is open.
- Locks the modal overlay to 100dvh.
- Centers the editor horizontally and vertically.
- Keeps the dimmed/blurred background.
- Keeps only the editor content area scrollable.
- Works on desktop, tablet, mobile, and short-height screens.
- Backdrop click, X close, and successful Save all clear modal-open state.

Everything from cumulative v86 is preserved.

f2w-force-save:readme-v87:1788227242
 