import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileSettings.css';

const ProfileSettings = () => {
    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileData, setProfileData] = useState({
        basicInfo: {},
        privacy: {},
        notifications: {},
        preferences: {},
        accessibility: {}
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchProfileSettings();
    }, []);

    const fetchProfileSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/profile-settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfileData(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setMessage({ type: 'error', text: 'Failed to load profile settings' });
            setLoading(false);
        }
    };

    const handleBasicInfoChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            basicInfo: { ...prev.basicInfo, [name]: value }
        }));
    };

    const handlePrivacyChange = (e) => {
        const { name, checked } = e.target;
        setProfileData(prev => ({
            ...prev,
            privacy: { ...prev.privacy, [name]: checked }
        }));
    };

    const handleNotificationChange = (e) => {
        const { name, checked } = e.target;
        setProfileData(prev => ({
            ...prev,
            notifications: { ...prev.notifications, [name]: checked }
        }));
    };

    const handlePreferenceChange = (e) => {
        const { name, value, type, checked } = e.target;
        setProfileData(prev => ({
            ...prev,
            preferences: { 
                ...prev.preferences, 
                [name]: type === 'checkbox' ? checked : value 
            }
        }));
    };

    const handleAccessibilityChange = (e) => {
        const { name, checked } = e.target;
        setProfileData(prev => ({
            ...prev,
            accessibility: { ...prev.accessibility, [name]: checked }
        }));
    };

    const saveBasicInfo = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/profile/basic-info', profileData.basicInfo, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: 'Basic information updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update basic information' });
        } finally {
            setSaving(false);
        }
    };

    const savePrivacySettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/profile/privacy', profileData.privacy, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: 'Privacy settings updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update privacy settings' });
        } finally {
            setSaving(false);
        }
    };

    const saveNotificationSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/profile/notifications', profileData.notifications, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: 'Notification settings updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update notification settings' });
        } finally {
            setSaving(false);
        }
    };

    const savePreferences = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/profile/preferences', profileData.preferences, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: 'Preferences updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update preferences' });
        } finally {
            setSaving(false);
        }
    };

    const saveAccessibilitySettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/profile/accessibility', profileData.accessibility, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: 'Accessibility settings updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update accessibility settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading-spinner">Loading profile settings...</div>;
    }

    return (
        <div className="profile-settings-container">
            <div className="profile-header">
                <h1>Profile Settings</h1>
                {message.text && (
                    <div className={`alert alert-${message.type}`}>
                        {message.text}
                    </div>
                )}
            </div>

            <div className="settings-tabs">
                <button 
                    className={activeTab === 'basic' ? 'active' : ''}
                    onClick={() => setActiveTab('basic')}
                >
                    Basic Information
                </button>
                <button 
                    className={activeTab === 'privacy' ? 'active' : ''}
                    onClick={() => setActiveTab('privacy')}
                >
                    Privacy
                </button>
                <button 
                    className={activeTab === 'notifications' ? 'active' : ''}
                    onClick={() => setActiveTab('notifications')}
                >
                    Notifications
                </button>
                <button 
                    className={activeTab === 'preferences' ? 'active' : ''}
                    onClick={() => setActiveTab('preferences')}
                >
                    Preferences
                </button>
                <button 
                    className={activeTab === 'accessibility' ? 'active' : ''}
                    onClick={() => setActiveTab('accessibility')}
                >
                    Accessibility
                </button>
            </div>

            <div className="settings-content">
                {activeTab === 'basic' && (
                    <div className="settings-section">
                        <h2>Basic Information</h2>
                        <form onSubmit={(e) => { e.preventDefault(); saveBasicInfo(); }}>
                            <div className="form-group">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={profileData.basicInfo.first_name || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Middle Name</label>
                                <input
                                    type="text"
                                    name="middle_name"
                                    value={profileData.basicInfo.middle_name || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={profileData.basicInfo.last_name || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone_number"
                                    value={profileData.basicInfo.phone_number || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Date of Birth</label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={profileData.basicInfo.date_of_birth || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Gender</label>
                                <select
                                    name="gender"
                                    value={profileData.basicInfo.gender || ''}
                                    onChange={handleBasicInfoChange}
                                >
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Bio</label>
                                <textarea
                                    name="bio"
                                    rows="4"
                                    value={profileData.basicInfo.bio || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Website</label>
                                <input
                                    type="url"
                                    name="website_url"
                                    value={profileData.basicInfo.website_url || ''}
                                    onChange={handleBasicInfoChange}
                                />
                            </div>
                            <button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'privacy' && (
                    <div className="settings-section">
                        <h2>Privacy Settings</h2>
                        <form onSubmit={(e) => { e.preventDefault(); savePrivacySettings(); }}>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="is_profile_public"
                                        checked={profileData.privacy.is_profile_public || false}
                                        onChange={handlePrivacyChange}
                                    />
                                    Make my profile public
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="show_email_publicly"
                                        checked={profileData.privacy.show_email_publicly || false}
                                        onChange={handlePrivacyChange}
                                    />
                                    Show email address publicly
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="show_phone_publicly"
                                        checked={profileData.privacy.show_phone_publicly || false}
                                        onChange={handlePrivacyChange}
                                    />
                                    Show phone number publicly
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="show_address_publicly"
                                        checked={profileData.privacy.show_address_publicly || false}
                                        onChange={handlePrivacyChange}
                                    />
                                    Show address publicly
                                </label>
                            </div>
                            <button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Privacy Settings'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="settings-section">
                        <h2>Notification Preferences</h2>
                        <form onSubmit={(e) => { e.preventDefault(); saveNotificationSettings(); }}>
                            <h3>Channels</h3>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="email_notifications_enabled"
                                        checked={profileData.notifications.email_notifications_enabled || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Email Notifications
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="push_notifications_enabled"
                                        checked={profileData.notifications.push_notifications_enabled || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Push Notifications
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="sms_notifications_enabled"
                                        checked={profileData.notifications.sms_notifications_enabled || false}
                                        onChange={handleNotificationChange}
                                    />
                                    SMS Notifications
                                </label>
                            </div>

                            <h3>Notify me about</h3>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="notify_order_updates"
                                        checked={profileData.notifications.notify_order_updates || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Order Updates
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="notify_promotions"
                                        checked={profileData.notifications.notify_promotions || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Promotions & Offers
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="notify_product_alerts"
                                        checked={profileData.notifications.notify_product_alerts || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Product Alerts
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="notify_review_responses"
                                        checked={profileData.notifications.notify_review_responses || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Review Responses
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="notify_wishlist_updates"
                                        checked={profileData.notifications.notify_wishlist_updates || false}
                                        onChange={handleNotificationChange}
                                    />
                                    Wishlist Updates
                                </label>
                            </div>
                            <button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Notification Settings'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'preferences' && (
                    <div className="settings-section">
                        <h2>Preferences</h2>
                        <form onSubmit={(e) => { e.preventDefault(); savePreferences(); }}>
                            <div className="form-group">
                                <label>Language</label>
                                <select
                                    name="preferred_language"
                                    value={profileData.preferences.preferred_language || 'en'}
                                    onChange={handlePreferenceChange}
                                >
                                    <option value="en">English</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="ja">Japanese</option>
                                    <option value="zh">Chinese</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Timezone</label>
                                <select
                                    name="timezone"
                                    value={profileData.preferences.timezone || 'UTC'}
                                    onChange={handlePreferenceChange}
                                >
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">Eastern Time</option>
                                    <option value="America/Chicago">Central Time</option>
                                    <option value="America/Denver">Mountain Time</option>
                                    <option value="America/Los_Angeles">Pacific Time</option>
                                    <option value="Asia/Manila">Philippines Time</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date Format</label>
                                <select
                                    name="date_format"
                                    value={profileData.preferences.date_format || 'YYYY-MM-DD'}
                                    onChange={handlePreferenceChange}
                                >
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                </select>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="auto_save_address"
                                        checked={profileData.preferences.auto_save_address || false}
                                        onChange={handlePreferenceChange}
                                    />
                                    Auto-save addresses
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="save_search_history"
                                        checked={profileData.preferences.save_search_history || false}
                                        onChange={handlePreferenceChange}
                                    />
                                    Save search history
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="allow_marketing_emails"
                                        checked={profileData.preferences.allow_marketing_emails || false}
                                        onChange={handlePreferenceChange}
                                    />
                                    Receive marketing emails
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="allow_analytics_tracking"
                                        checked={profileData.preferences.allow_analytics_tracking || true}
                                        onChange={handlePreferenceChange}
                                    />
                                    Allow analytics tracking
                                </label>
                            </div>
                            <button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'accessibility' && (
                    <div className="settings-section">
                        <h2>Accessibility Settings</h2>
                        <form onSubmit={(e) => { e.preventDefault(); saveAccessibilitySettings(); }}>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="accessibility_mode"
                                        checked={profileData.accessibility.accessibility_mode || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Enable Accessibility Mode
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="voice_navigation"
                                        checked={profileData.accessibility.voice_navigation || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Voice Navigation
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="text_to_speech"
                                        checked={profileData.accessibility.text_to_speech || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Text to Speech
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="high_contrast"
                                        checked={profileData.accessibility.high_contrast || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    High Contrast Mode
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="large_text"
                                        checked={profileData.accessibility.large_text || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Large Text
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="reduced_motion"
                                        checked={profileData.accessibility.reduced_motion || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Reduced Motion
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="focus_indicators"
                                        checked={profileData.accessibility.focus_indicators || true}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Focus Indicators
                                </label>
                            </div>
                            <div className="form-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="screen_reader_optimized"
                                        checked={profileData.accessibility.screen_reader_optimized || false}
                                        onChange={handleAccessibilityChange}
                                    />
                                    Screen Reader Optimized
                                </label>
                            </div>
                            <button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Accessibility Settings'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileSettings;