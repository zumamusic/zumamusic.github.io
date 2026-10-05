ZUMA MUSIC WEBSITE PACKAGE

This is the static Zuma site with the Contact, Socials, and Archives windows.
Keep the entire folder together when deploying to GitHub Pages or another host.

LOCAL PREVIEW
From this folder, run: python3 -m http.server 4174
Then visit: http://127.0.0.1:4174/

ARCHIVES
Click the archive icon in the dock to open Archives. Click the Socials desktop
icon to open the coming soon window. The tree currently
contains Archives 1 with eight photos and one video. Open a thumbnail to use
the viewer; arrows and the filmstrip move between files. The video has a play
button in the grid and native playback controls in the viewer.
All three windows can be dragged by their title bars, resized from the bottom-
right corner, and minimized. Drag a window downward by its title bar until its
lower edge reaches the dock to minimize it there. A window gets a glass task
button in the dock only while minimized. Click the button to restore it. Swipe or drag
horizontally along the task strip to reach more minimized windows.
The Archives square button maximizes or restores that window.
On a short landscape mobile screen, scroll down to reach the desktop icons;
opened windows stay within the visible area above the dock.

The folder list and file order are in archives.js. To add a future collection
such as a show or season, add its media under archive-media/<folder-name>/ and
add another object to the collections array in archives.js.

The browser media are resized copies of the supplied files. The source images
and MOV are preserved outside this deployment folder, in the work directory.
The MP4 is H.264/AAC and has source metadata removed.

CONTACT AND WAITLIST
The contact form points to FormSubmit for demos@zuma.music. That mailbox must
approve FormSubmit's activation email before delivery can be relied upon. The
waitlist form is currently a visual placeholder and does not collect signups.
