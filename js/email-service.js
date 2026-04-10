// EmailJS Integration Service
// Requires js/email-config.js with { EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, EMAIL_PUBLIC_KEY }
// Create that file from email-config.example.js and fill in your EmailJS credentials.

// Config loaded lazily on first use (avoids top-level await / module load errors)
let _config = null;

async function getConfig() {
    if (_config) return _config;
    try {
        const mod = await import('./email-config.js');
        _config = {
            serviceId:  mod.EMAIL_SERVICE_ID  || '',
            templateId: mod.EMAIL_TEMPLATE_ID || '',
            publicKey:  mod.EMAIL_PUBLIC_KEY  || ''
        };
    } catch (e) {
        console.warn('⚠️ email-config.js not found. Email features will be disabled. Create js/email-config.js with your EmailJS credentials.');
        _config = { serviceId: '', templateId: '', publicKey: '' };
    }
    return _config;
}

class EmailService {
    constructor() {
        this.isInitialized = false;
        this._cfg = null; // lazily populated
    }

    async _getEnsuredConfig() {
        if (!this._cfg) this._cfg = await getConfig();
        return this._cfg;
    }

    async init() {
        if (this.isInitialized) return;
        const cfg = await this._getEnsuredConfig();
        if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
            console.warn('EmailJS not configured — skipping init.');
            return;
        }

        // Dynamically inject EmailJS script if not present
        if (typeof emailjs === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load EmailJS SDK'));
                document.head.appendChild(script);
            });
        }

        try {
            emailjs.init(cfg.publicKey);
            this.isInitialized = true;
            console.log('✅ EmailJS Initialized');
        } catch (error) {
            console.error('❌ Error initializing EmailJS:', error);
        }
    }

    /**
     * Send an email notification
     * @param {Object} templateParams - Variables mapping to the EmailJS template
     */
    async sendEmail(templateParams) {
        const cfg = await this._getEnsuredConfig();
        if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
            console.warn('Email service not configured — skipping send.');
            return;
        }
        await this.init();
        if (!this.isInitialized) throw new Error('Email service not initialized');

        try {
            const response = await emailjs.send(cfg.serviceId, cfg.templateId, templateParams);
            console.log('✅ Email sent successfully!', response.status, response.text);
            return response;
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw error;
        }
    }

    /** Workflow 1: New join request notification to creator */
    async sendRequestNotification(creatorEmail, creatorName, requesterName, groupName, message) {
        return this.sendEmail({
            to_email: creatorEmail,
            to_name: creatorName,
            subject: `New Join Request for ${groupName}`,
            body_message: `${requesterName} has requested to join your group "${groupName}".\n\nThey said: "${message}"\n\nLog in to your dashboard to Approve or Reject this request.`
        });
    }

    /** Workflow 2: Requester approved — includes private group link */
    async sendApprovalEmail(requesterEmail, requesterName, groupName, privateLink) {
        return this.sendEmail({
            to_email: requesterEmail,
            to_name: requesterName,
            subject: `✅ Approved: Welcome to ${groupName}!`,
            body_message: `Great news, ${requesterName}!\n\nYour request to join the group "${groupName}" has been approved.\n\nHere is your private invitation link to join the group chat:\n${privateLink}\n\nPlease do not share this link with anyone else.`
        });
    }

    /** Workflow 3: Requester rejected */
    async sendRejectionEmail(requesterEmail, requesterName, groupName) {
        return this.sendEmail({
            to_email: requesterEmail,
            to_name: requesterName,
            subject: `Update regarding ${groupName}`,
            body_message: `Hi ${requesterName},\n\nThank you for your interest in joining "${groupName}".\n\nUnfortunately, the creator was unable to approve your request at this time. Keep exploring the dashboard for other groups that might be a great fit!`
        });
    }
}

export const emailService = new EmailService();
