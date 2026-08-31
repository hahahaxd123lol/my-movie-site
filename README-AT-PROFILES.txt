FLIX2WATCH @USERNAME PROFILE URL PACK

Upload EVERYTHING in this pack to the ROOT of your GitHub Pages repository,
preserving the folders.

Clean URLs:

https://flix2watch.com/home/
https://flix2watch.com/watch/?id=123&type=movie
https://flix2watch.com/favorites/
https://flix2watch.com/profile/@josh

Profile searches, chat/profile links and Copy Link now use /profile/@username.

IMPORTANT GITHUB PAGES NOTE:
GitHub Pages cannot dynamically create a physical folder for every future username.
The included 404.html acts as a route fallback specifically for /profile/@username,
so direct visits such as /profile/@josh still render the profile while keeping that
URL visible in the browser.

Old /profile/@josh links remain readable for backwards compatibility.
