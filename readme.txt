=== Jamie's Distraction-Free Writer ===
Contributors: jamiemarsland
Tags: writing, front-end editor, distraction-free, interactivity api
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 8.0
Stable tag: 1.0.4
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A beautiful, distraction-free front-end writing experience for WordPress.

== Description ==

Jamie's Distraction-Free Writer reimagines the WordPress publishing experience for writers. Navigate to /write/ on your site and get a clean, full-screen writing page with just a title and a content area.

**Features:**

* Full-screen distraction-free writing — no admin dashboard
* Floating formatting toolbar — appears on text selection
* Slash commands — type / for headings, images, videos, quotes, dividers
* Image upload with preview, alt text, captions, and featured image support
* Video embedding from YouTube and Vimeo
* Categories via a floating popover
* Save as draft or publish — creates proper WordPress block markup
* Edit existing posts from the front end
* Admin bar slides away while writing

Built on the WordPress Interactivity API with no build step required.

== Installation ==

1. Upload the `jamies-distraction-free-writer` folder to `/wp-content/plugins/`
2. Activate the plugin through the Plugins menu
3. Visit /write/ on your site to start writing

== Frequently Asked Questions ==

= Where do I start writing? =

Once activated, go to /write/ on your site (you must be logged in with permission to publish posts). You can also click "Write" in the admin toolbar.

= Does it work with my theme? =

Yes. The writing page is a self-contained full-screen experience, and published content is saved as standard WordPress block markup, so it displays with your theme like any other post.

= Does it require a build step? =

No. The plugin is built on the WordPress Interactivity API and ships ready to run.

== Changelog ==

= 1.0.4 =
* The Save draft / Publish / Update buttons are now disabled until you make a change, so you can't save when nothing has changed.

= 1.0.3 =
* Added a live demo preview (WordPress Playground blueprint).
* Hid the "Save draft" button when editing an already-published post (saving it as a draft would unpublish it).
* The primary button now relabels from "Publish" to "Update" once a new post has been published.
* Improved the writing area placeholder ("Tell your story..."): it now stays visible until you click in, then clears with the cursor at the start.

= 1.0.2 =
* Added a "Write" link to the Posts list table row actions, so you can open any post in the distraction-free writer from the admin Posts screen.
* Hid the editor's popups on first load so they no longer flash before the page is ready.

= 1.0.1 =
* Added a plugin icon.

= 1.0.0 =
* Initial release.
