<?php
/**
 * Plugin Name: Jamie's Distraction-Free Writer
 * Description: A beautiful, distraction-free front-end writing experience. Create and edit posts from a clean /write/ page without touching wp-admin.
 * Version: 1.0.5
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Author: Jamie Marsland
 * Author URI: https://profiles.wordpress.org/jamiemarsland/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: jamies-distraction-free-writer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the /write/ rewrite endpoint.
 */
add_action( 'init', function () {
	add_rewrite_rule( '^write/?$', 'index.php?jdfw_write=1', 'top' );

	wp_register_script_module(
		'jamies-distraction-free-writer/view',
		plugins_url( 'view.js', __FILE__ ),
		array( '@wordpress/interactivity' ),
		'1.0.0'
	);
} );

add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'jdfw_write';
	return $vars;
} );

/**
 * Flush rewrite rules on activation.
 */
register_activation_hook( __FILE__, function () {
	add_rewrite_rule( '^write/?$', 'index.php?jdfw_write=1', 'top' );
	flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );

/**
 * Serve the writing page template.
 */
add_action( 'template_redirect', function () {
	if ( ! get_query_var( 'jdfw_write' ) ) {
		return;
	}

	// Gate access.
	if ( ! is_user_logged_in() ) {
		wp_safe_redirect( wp_login_url( home_url( '/write/' ) ) );
		exit;
	}

	if ( ! current_user_can( 'publish_posts' ) ) {
		wp_safe_redirect( home_url( '/' ) );
		exit;
	}

	// Enqueue assets.
	wp_enqueue_script_module( 'jamies-distraction-free-writer/view' );
	wp_enqueue_style( 'dashicons' );
	wp_enqueue_style(
		'jamies-distraction-free-writer',
		plugins_url( 'style.css', __FILE__ ),
		array( 'dashicons' ),
		'1.0.0'
	);

	// Check if editing an existing post.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only GET parameter, gated by capability check below.
	$edit_post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
	$edit_title   = '';
	$edit_content = '';
	$post_status  = 'new';

	if ( $edit_post_id ) {
		$edit_post = get_post( $edit_post_id );
		if ( $edit_post && current_user_can( 'edit_post', $edit_post_id ) ) {
			$edit_title       = $edit_post->post_title;
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core filter needed to render blocks.
			$edit_content     = apply_filters( 'the_content', $edit_post->post_content );
			$post_status      = $edit_post->post_status;
			$edit_featured_id = (int) get_post_thumbnail_id( $edit_post_id );
		} else {
			$edit_post_id = 0;
		}
	}

	// Build categories list for the UI.
	$all_cats       = get_categories( array( 'hide_empty' => false ) );
	$selected_cats  = $edit_post_id ? wp_get_post_categories( $edit_post_id ) : array();
	$categories_data = array();
	foreach ( $all_cats as $cat ) {
		$categories_data[] = array(
			'id'       => $cat->term_id,
			'name'     => $cat->name,
			'selected' => in_array( $cat->term_id, $selected_cats, true ),
		);
	}

	// Seed Interactivity API state.
	wp_interactivity_state( 'jamies-distraction-free-writer', array(
		'restNonce'     => wp_create_nonce( 'wp_rest' ),
		'postsEndpoint' => rest_url( 'wp/v2/posts' ),
		'mediaEndpoint' => rest_url( 'wp/v2/media' ),
		'homeUrl'       => home_url( '/' ),
		'editPostId'    => $edit_post_id,
		'postStatus'    => $post_status,
		'publishLabel'  => $edit_post_id ? 'Update' : 'Publish',
		'title'         => $edit_title,
		'isSaving'      => false,
		'isPublished'   => false,
		'message'       => '',
		'showToolbar'   => false,
		'showLinkInput' => false,
		'linkUrl'       => '',
		'showImageModal' => false,
		'showVideoModal' => false,
		'videoUrl'       => '',
		'imageAlt'       => '',
		'setAsFeatured'  => false,
		'featuredMediaId' => isset( $edit_featured_id ) ? $edit_featured_id : 0,
		'isUploading'   => false,
		'categories'    => $categories_data,
		'showCatPicker' => false,
		'showHelp'      => false,
		'showSlashMenu' => false,
		'slashFilter'   => '',
		'showLeaveConfirm' => false,
	) );

	// Output the full page.
	jdfw_template( $edit_title, $edit_content, $edit_post_id, $categories_data, $post_status );
	exit;
} );

/**
 * Render the distraction-free writing page.
 */
function jdfw_template( $edit_title = '', $edit_content = '', $edit_post_id = 0, $categories_data = array(), $post_status = 'new' ) {
	?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php echo esc_attr( get_bloginfo( 'charset' ) ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Write &mdash; <?php echo esc_html( get_bloginfo( 'name' ) ); ?></title>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<div data-wp-interactive="jamies-distraction-free-writer" class="bw-app" data-wp-class--bw-dark="state.darkMode">

	<!-- Top bar -->
	<header class="bw-topbar">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="bw-back" title="Back to site" data-wp-on--click="actions.handleBack">&larr;</a>
		<button class="bw-help-toggle" data-wp-on--click="actions.toggleHelp" title="Shortcuts">?</button>
		<button class="bw-theme-toggle" data-wp-on--click="actions.toggleDark" title="Toggle dark mode" aria-label="Toggle dark mode">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
		</button>
		<div class="bw-help-popover" data-wp-bind--hidden="!state.showHelp" hidden>
			<div class="bw-help-title">Tips</div>
			<div class="bw-help-row"><kbd>/</kbd><span>Insert a heading, image, video, quote or divider</span></div>
			<div class="bw-help-row"><kbd>Select text</kbd><span>Formatting toolbar appears</span></div>
			<div class="bw-help-row"><kbd>Tab</kbd><span>Navigate slash menu options</span></div>
		</div>
		<span class="bw-status" data-wp-text="state.message"></span>
		<div class="bw-topbar-actions">
			<button
				class="bw-btn bw-btn-draft"
				data-wp-on--click="actions.saveDraft"
				data-wp-bind--disabled="state.saveDisabled"
				data-wp-bind--hidden="state.hideSaveDraft"
				<?php echo ( 'publish' === $post_status ) ? 'hidden' : ''; ?>
			>Save draft</button>
			<button
				class="bw-btn bw-btn-publish"
				data-wp-on--click="actions.publish"
				data-wp-bind--disabled="state.saveDisabled"
				data-wp-text="state.publishLabel"
			><?php echo esc_html( $edit_post_id ? 'Update' : 'Publish' ); ?></button>
		</div>
	</header>

	<!-- Writing area -->
	<main class="bw-main" data-wp-on--click="actions.enterFocus">
		<div class="bw-editor">
			<textarea
				class="bw-title"
				placeholder="Title"
				rows="1"
				data-wp-on--input="actions.updateTitle"
				data-wp-on--keydown="actions.handleTitleKeyDown"
				autocomplete="off"
			><?php echo esc_textarea( $edit_title ); ?></textarea>
			<div class="bw-separator"></div>
			<div
				class="bw-content"
				contenteditable="true"
				data-wp-on--input="actions.markDirty"
				data-wp-on--mouseup="actions.checkFormatting"
				data-wp-on--keyup="actions.checkFormatting"
				data-wp-on--keydown="actions.handleKeyDown"
				data-wp-on--click="actions.enterFocus"
				data-placeholder="Tell your story..."
			><?php echo wp_kses_post( $edit_content ); ?></div>
		</div>
	</main>

	<!-- Floating formatting toolbar -->
	<div
		class="bw-toolbar"
		data-wp-bind--hidden="!state.showToolbar"
		data-wp-on--mousedown="actions.preventToolbarBlur"
		hidden
	>
		<button class="bw-tool" data-wp-on--click="actions.formatHeading" data-wp-class--bw-tool-active="state.formatHeading" title="Heading"><span class="dashicons dashicons-heading"></span></button>
		<span class="bw-tool-divider"></span>
		<button class="bw-tool" data-wp-on--click="actions.formatBold" data-wp-class--bw-tool-active="state.formatBold" title="Bold"><span class="dashicons dashicons-editor-bold"></span></button>
		<button class="bw-tool" data-wp-on--click="actions.formatItalic" data-wp-class--bw-tool-active="state.formatItalic" title="Italic"><span class="dashicons dashicons-editor-italic"></span></button>
		<span class="bw-tool-divider"></span>
		<button class="bw-tool" data-wp-on--click="actions.formatQuote" data-wp-class--bw-tool-active="state.formatQuote" title="Quote"><span class="dashicons dashicons-format-quote"></span></button>
		<span class="bw-tool-divider"></span>
		<button class="bw-tool" data-wp-on--click="actions.toggleLinkInput" title="Link"><span class="dashicons dashicons-admin-links"></span></button>
		<button class="bw-tool" data-wp-on--click="actions.openImageModal" title="Image"><span class="dashicons dashicons-format-image"></span></button>
	</div>

	<!-- Link input popover -->
	<div class="bw-link-popover" data-wp-bind--hidden="!state.showLinkInput" hidden>
		<input
			type="url"
			class="bw-link-input"
			placeholder="Paste or type a link..."
			data-wp-on--input="actions.updateLinkUrl"
			data-wp-on--keydown="actions.handleLinkKeyDown"
		/>
		<button class="bw-link-apply" data-wp-on--click="actions.applyLink">Apply</button>
		<button class="bw-link-remove" data-wp-on--click="actions.removeLink">&times;</button>
	</div>

	<!-- Image modal -->
	<div class="bw-image-overlay" data-wp-bind--hidden="!state.showImageModal" data-wp-on--click="actions.closeImageModal" hidden>
		<div class="bw-image-modal" data-wp-on--click="actions.stopPropagation">
			<h3>Add an image</h3>
			<label class="bw-upload-zone" id="bw-upload-zone">
				<span class="bw-upload-label">Drop a file or click to upload</span>
				<span class="bw-upload-saving" style="display:none;">Uploading...</span>
				<input type="file" accept="image/*" data-wp-on--change="actions.uploadImage" hidden />
			</label>
			<div class="bw-image-divider"><span>or</span></div>
			<input
				type="url"
				class="bw-image-url-input"
				placeholder="Paste an image URL..."
				data-wp-on--input="actions.updateImageUrl"
			/>
			<input
				type="text"
				class="bw-image-url-input"
				placeholder="Alt text (describe the image)..."
				data-wp-on--input="actions.updateImageAlt"
				style="margin-top:12px;"
			/>
			<label class="bw-featured-toggle">
				<input type="checkbox" data-wp-on--change="actions.toggleFeaturedImage" />
				<span>Set as featured image</span>
			</label>
			<button class="bw-btn bw-btn-publish" data-wp-on--click="actions.insertImageFromUrl" style="width:100%;margin-top:12px;">Insert image</button>
		</div>
	</div>

	<!-- Leave confirmation -->
	<div class="bw-image-overlay" data-wp-bind--hidden="!state.showLeaveConfirm" data-wp-on--click="actions.cancelLeave" hidden>
		<div class="bw-leave-modal" data-wp-on--click="actions.stopPropagation">
			<h3>You have unsaved changes</h3>
			<p>Are you sure you want to leave? Your work will be lost.</p>
			<div class="bw-leave-actions">
				<button class="bw-btn bw-btn-draft" data-wp-on--click="actions.cancelLeave">Keep writing</button>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="bw-btn bw-btn-leave">Leave</a>
			</div>
		</div>
	</div>

	<!-- Slash command menu -->
	<div class="bw-slash-menu" data-wp-bind--hidden="!state.showSlashMenu" hidden>
		<div class="bw-slash-item" data-wp-on--click="actions.insertHeading" data-wp-on--mousedown="actions.preventToolbarBlur">
			<span class="bw-slash-icon">H</span>
			<div><strong>Heading</strong><span class="bw-slash-desc">Large section heading</span></div>
		</div>
		<div class="bw-slash-item" data-wp-on--click="actions.insertImage" data-wp-on--mousedown="actions.preventToolbarBlur">
			<span class="bw-slash-icon">&#9653;</span>
			<div><strong>Image</strong><span class="bw-slash-desc">Upload or embed an image</span></div>
		</div>
		<div class="bw-slash-item" data-wp-on--click="actions.insertQuote" data-wp-on--mousedown="actions.preventToolbarBlur">
			<span class="bw-slash-icon">&ldquo;</span>
			<div><strong>Quote</strong><span class="bw-slash-desc">Highlight a quote</span></div>
		</div>
		<div class="bw-slash-item" data-wp-on--click="actions.insertVideo" data-wp-on--mousedown="actions.preventToolbarBlur">
			<span class="bw-slash-icon">&#9654;</span>
			<div><strong>Video</strong><span class="bw-slash-desc">Embed a YouTube or Vimeo video</span></div>
		</div>
		<div class="bw-slash-item" data-wp-on--click="actions.insertDivider" data-wp-on--mousedown="actions.preventToolbarBlur">
			<span class="bw-slash-icon">&mdash;</span>
			<div><strong>Divider</strong><span class="bw-slash-desc">A horizontal separator</span></div>
		</div>
	</div>

	<!-- Video modal -->
	<div class="bw-image-overlay" data-wp-bind--hidden="!state.showVideoModal" data-wp-on--click="actions.closeVideoModal" hidden>
		<div class="bw-image-modal" data-wp-on--click="actions.stopPropagation">
			<h3>Embed a video</h3>
			<input
				type="url"
				class="bw-image-url-input"
				placeholder="Paste a YouTube or Vimeo URL..."
				data-wp-on--input="actions.updateVideoUrl"
				data-wp-on--keydown="actions.handleVideoKeyDown"
			/>
			<button class="bw-btn bw-btn-publish" data-wp-on--click="actions.insertVideoEmbed" style="width:100%;margin-top:12px;">Embed video</button>
		</div>
	</div>

	<!-- Floating category picker -->
	<div class="bw-cat-fab" data-wp-on--click="actions.toggleCatPicker">
		<span class="bw-cat-fab-icon dashicons dashicons-admin-generic"></span>
	</div>
	<div class="bw-cat-popover" data-wp-bind--hidden="!state.showCatPicker" hidden>
		<div class="bw-cat-popover-header">Categories</div>
		<div class="bw-cat-popover-list">
			<?php foreach ( $categories_data as $i => $cat ) : ?>
			<button
				class="bw-cat<?php echo esc_attr( $cat['selected'] ? ' bw-cat-selected' : '' ); ?>"
				data-wp-on--click="actions.toggleCategory"
				data-wp-context='<?php echo esc_attr( wp_json_encode( array( 'catIndex' => $i, 'catSelected' => $cat['selected'] ) ) ); ?>'
				data-wp-class--bw-cat-selected="context.catSelected"
			><?php echo esc_html( $cat['name'] ); ?></button>
			<?php endforeach; ?>
		</div>
	</div>

</div>

<?php wp_footer(); ?>
</body>
</html>
	<?php
}


/**
 * Add "Write" link to the admin toolbar.
 */
add_action( 'admin_bar_menu', function ( $wp_admin_bar ) {
	if ( ! current_user_can( 'publish_posts' ) ) {
		return;
	}

	// Remove default +New, Edit Post, and Edit Site nodes.
	$wp_admin_bar->remove_node( 'new-content' );
	$wp_admin_bar->remove_node( 'edit' );
	$wp_admin_bar->remove_node( 'site-editor' );

	$wp_admin_bar->add_node( array(
		'id'    => 'jdfw-write',
		'title' => 'Write',
		'href'  => home_url( '/write/' ),
		'meta'  => array( 'title' => 'Write a new post' ),
	) );

	// Add "Edit Post" when viewing a single post.
	if ( is_singular( 'post' ) ) {
		$post_id = get_queried_object_id();
		if ( $post_id && current_user_can( 'edit_post', $post_id ) ) {
			$wp_admin_bar->add_node( array(
				'id'    => 'jdfw-edit-post',
				'title' => 'Edit Post',
				'href'  => home_url( '/write/?post=' . $post_id ),
				'meta'  => array( 'title' => 'Edit this post' ),
			) );
		}
	}
}, 999 );


/**
 * Add a "Write" row action to the Posts list table, so posts can be opened in
 * the distraction-free writer straight from the admin Posts screen.
 */
add_filter( 'post_row_actions', function ( $actions, $post ) {
	if ( 'post' === $post->post_type && current_user_can( 'edit_post', $post->ID ) ) {
		$actions['jdfw_write'] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( home_url( '/write/?post=' . $post->ID ) ),
			esc_html__( 'Write', 'jamies-distraction-free-writer' )
		);
	}
	return $actions;
}, 10, 2 );
