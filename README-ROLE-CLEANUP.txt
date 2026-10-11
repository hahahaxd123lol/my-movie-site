FLIX2WATCH ROLE BADGE CLEANUP

PROFILE NAME RULE:
- Normal account: no icon, no shield, no role badge.
- Owner: red shield + Owner, only when viewedProfile.user_id matches OWNER_UUID.
- Staff: purple shield + Staff, only when get_public_profile_role(username) returns exactly "staff".
- Private-profile status no longer places an icon beside the display name.

TOP BAR:
- Normal logged-in account: no role shield.
- Owner/Staff only: role badge is dynamically created.

PROFILE COLOUR:
- The profile colour/theme feature has been removed from the frontend completely.
- optional_remove_profile_theme_color.sql can remove the unused DB column if desired.

GENRE PAGINATION:
- The previous fix that returns users to the top of the movie list on page changes remains included.
