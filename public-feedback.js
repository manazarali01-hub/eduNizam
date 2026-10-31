/* Real private EduNizam feedback submission.
   Data goes to the platform Supabase inbox; never store user messages in the public page.
   No success message is displayed unless the API confirms acceptance. */
(() => {
  'use strict';
  const form = document.getElementById('edu-public-feedback-form');
  if (!form) return;
  const button = document.getElementById('edu-feedback-submit');
  const status = document.getElementById('edu-feedback-status');
  const endpoint = 'https://qmdiexentozvhhfjvlmr.supabase.co/rest/v1/platform_feedback';
  const throttleKey = 'edunizam_public_feedback_last_success';
  const minGapMs = 90 * 1000;
  let sending = false;
  const setStatus = (message, kind) => {
    status.textContent = message;
    if (kind) status.dataset.kind = kind;
    else delete status.dataset.kind;
  };
  const getLastSent = () => {
    try { return Number(localStorage.getItem(throttleKey)) || 0; }
    catch (_) { return 0; }
  };
  const saveLastSent = () => {
    try { localStorage.setItem(throttleKey, String(Date.now())); }
    catch (_) {}
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;
    const category = String(data.get('category') || '').trim();
    const message = String(data.get('message') || '').trim();
    const ratingRaw = String(data.get('rating') || '').trim();
    const rating = ratingRaw ? Number(ratingRaw) : null;
    if (!['bug', 'missing_data', 'suggestion', 'appreciation'].includes(category) ||
        message.length < 20 || message.length > 1500 ||
        (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5))) {
      setStatus('Please choose a topic and write 20–1500 characters of feedback.', 'error');
      return;
    }
    if (Date.now() - getLastSent() < minGapMs) {
      setStatus('Your last feedback was received. Please allow a minute before sending another.', 'error');
      return;
    }
    const key = window.EDUNIZAM_CLOUD_CONFIG?.supabasePublishableKey;
    if (!key || !String(key).startsWith('sb_publishable_')) {
      setStatus('Feedback service is not configured. Please try again later.', 'error');
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    setStatus('Sending your feedback securely…');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ category, message, rating })
      });
      if (!response.ok) throw new Error('Feedback API returned ' + response.status);
      saveLastSent();
      form.reset();
      setStatus('Thank you. Your private feedback has been received for review.', 'success');
    } catch (error) {
      setStatus('Feedback could not be sent. Your message is still here; please try again.', 'error');
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = 'Send feedback →';
    }
  });
})();
