const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateToken = require('../middleware/auth');

// Get all profile settings for authenticated user
router.get('/profile-settings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const query = `
            SELECT 
                -- Basic profile info
                p.id, p.username, p.first_name, p.middle_name, p.last_name, 
                p.extension_name, p.email, p.phone_number, p.avatar_url, 
                p.role, p.date_of_birth, p.gender, p.bio, p.website_url, 
                p.social_links, p.is_verified, p.last_login,
                
                -- Profile settings
                ups.is_profile_public, ups.show_email_publicly, 
                ups.show_phone_publicly, ups.show_address_publicly,
                ups.email_notifications_enabled, ups.push_notifications_enabled,
                ups.sms_notifications_enabled, ups.notify_order_updates,
                ups.notify_promotions, ups.notify_product_alerts,
                ups.notify_review_responses, ups.notify_wishlist_updates,
                ups.preferred_language, ups.timezone, ups.date_format,
                ups.default_payment_method_id, ups.auto_save_address,
                ups.save_search_history, ups.allow_marketing_emails,
                ups.allow_analytics_tracking, ups.two_factor_enabled,
                ups.session_timeout_minutes,
                
                -- Accessibility settings
                us.accessibility_mode, us.voice_navigation, us.text_to_speech,
                us.high_contrast, us.large_text, us.reduced_motion,
                us.focus_indicators, us.screen_reader_optimized
                
            FROM profiles p
            LEFT JOIN user_profile_settings ups ON p.id = ups.user_id
            LEFT JOIN user_settings us ON p.id = us.user_id
            WHERE p.id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update basic profile information
router.put('/profile/basic-info', authenticateToken, async (req, res) => {
    const { 
        first_name, middle_name, last_name, extension_name, 
        phone_number, date_of_birth, gender, bio, website_url, social_links 
    } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            UPDATE profiles 
            SET first_name = COALESCE($1, first_name),
                middle_name = COALESCE($2, middle_name),
                last_name = COALESCE($3, last_name),
                extension_name = COALESCE($4, extension_name),
                phone_number = COALESCE($5, phone_number),
                date_of_birth = COALESCE($6, date_of_birth),
                gender = COALESCE($7, gender),
                bio = COALESCE($8, bio),
                website_url = COALESCE($9, website_url),
                social_links = COALESCE($10, social_links),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING *
        `;
        
        const values = [
            first_name, middle_name, last_name, extension_name,
            phone_number, date_of_birth, gender, bio, website_url,
            social_links, userId
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Update privacy settings
router.put('/profile/privacy', authenticateToken, async (req, res) => {
    const { 
        is_profile_public, show_email_publicly, 
        show_phone_publicly, show_address_publicly 
    } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            INSERT INTO user_profile_settings (
                user_id, is_profile_public, show_email_publicly,
                show_phone_publicly, show_address_publicly, updated_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                is_profile_public = EXCLUDED.is_profile_public,
                show_email_publicly = EXCLUDED.show_email_publicly,
                show_phone_publicly = EXCLUDED.show_phone_publicly,
                show_address_publicly = EXCLUDED.show_address_publicly,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [userId, is_profile_public, show_email_publicly, show_phone_publicly, show_address_publicly];
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update privacy settings' });
    }
});

// Update notification preferences
router.put('/profile/notifications', authenticateToken, async (req, res) => {
    const {
        email_notifications_enabled, push_notifications_enabled,
        sms_notifications_enabled, notify_order_updates,
        notify_promotions, notify_product_alerts,
        notify_review_responses, notify_wishlist_updates
    } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            INSERT INTO user_profile_settings (
                user_id, email_notifications_enabled, push_notifications_enabled,
                sms_notifications_enabled, notify_order_updates, notify_promotions,
                notify_product_alerts, notify_review_responses, notify_wishlist_updates,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                email_notifications_enabled = EXCLUDED.email_notifications_enabled,
                push_notifications_enabled = EXCLUDED.push_notifications_enabled,
                sms_notifications_enabled = EXCLUDED.sms_notifications_enabled,
                notify_order_updates = EXCLUDED.notify_order_updates,
                notify_promotions = EXCLUDED.notify_promotions,
                notify_product_alerts = EXCLUDED.notify_product_alerts,
                notify_review_responses = EXCLUDED.notify_review_responses,
                notify_wishlist_updates = EXCLUDED.notify_wishlist_updates,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            userId, email_notifications_enabled, push_notifications_enabled,
            sms_notifications_enabled, notify_order_updates, notify_promotions,
            notify_product_alerts, notify_review_responses, notify_wishlist_updates
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update notification settings' });
    }
});

// Update preferences
router.put('/profile/preferences', authenticateToken, async (req, res) => {
    const {
        preferred_language, timezone, date_format,
        auto_save_address, save_search_history,
        allow_marketing_emails, allow_analytics_tracking
    } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            INSERT INTO user_profile_settings (
                user_id, preferred_language, timezone, date_format,
                auto_save_address, save_search_history,
                allow_marketing_emails, allow_analytics_tracking, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                preferred_language = EXCLUDED.preferred_language,
                timezone = EXCLUDED.timezone,
                date_format = EXCLUDED.date_format,
                auto_save_address = EXCLUDED.auto_save_address,
                save_search_history = EXCLUDED.save_search_history,
                allow_marketing_emails = EXCLUDED.allow_marketing_emails,
                allow_analytics_tracking = EXCLUDED.allow_analytics_tracking,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            userId, preferred_language, timezone, date_format,
            auto_save_address, save_search_history,
            allow_marketing_emails, allow_analytics_tracking
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Update accessibility settings
router.put('/profile/accessibility', authenticateToken, async (req, res) => {
    const {
        accessibility_mode, voice_navigation, text_to_speech,
        high_contrast, large_text, reduced_motion,
        focus_indicators, screen_reader_optimized
    } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            INSERT INTO user_settings (
                user_id, accessibility_mode, voice_navigation, text_to_speech,
                high_contrast, large_text, reduced_motion,
                focus_indicators, screen_reader_optimized, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                accessibility_mode = EXCLUDED.accessibility_mode,
                voice_navigation = EXCLUDED.voice_navigation,
                text_to_speech = EXCLUDED.text_to_speech,
                high_contrast = EXCLUDED.high_contrast,
                large_text = EXCLUDED.large_text,
                reduced_motion = EXCLUDED.reduced_motion,
                focus_indicators = EXCLUDED.focus_indicators,
                screen_reader_optimized = EXCLUDED.screen_reader_optimized
            RETURNING *
        `;
        
        const values = [
            userId, accessibility_mode, voice_navigation, text_to_speech,
            high_contrast, large_text, reduced_motion,
            focus_indicators, screen_reader_optimized
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update accessibility settings' });
    }
});

// Update avatar
router.post('/profile/avatar', authenticateToken, async (req, res) => {
    const { avatar_url } = req.body;
    const userId = req.user.id;
    
    try {
        const query = `
            UPDATE profiles 
            SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING avatar_url
        `;
        
        const result = await pool.query(query, [avatar_url, userId]);
        res.json({ avatar_url: result.rows[0].avatar_url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

module.exports = router;