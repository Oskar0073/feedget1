
(function () {
  const scriptTag = document.currentScript;
  const title = scriptTag.dataset.title || 'Leave Feedback';
  const placeholder = scriptTag.dataset.placeholder || 'Your feedback...';
  const supabaseUrl = scriptTag.dataset.supabaseUrl;
  const supabaseKey = scriptTag.dataset.supabaseKey;
  const theme = scriptTag.dataset.theme || 'light';
  const position = scriptTag.dataset.position || 'bottom-right';
  const storage = scriptTag.dataset.storage || 'sessionStorage'; // localStorage lub sessionStorage
  
  // Parsowanie niestandardowych pytań
  const customQuestions = scriptTag.dataset.questions 
    ? JSON.parse(scriptTag.dataset.questions) 
    : [];

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration.');
    return;
  }

  const widget = document.createElement('div');
  widget.className = `feedback-widget ${theme} ${position}`;
  
  // Generowanie HTML dla niestandardowych pytań
  let questionsHTML = '';
  customQuestions.forEach((q, index) => {
    questionsHTML += `
      <div class="question-container">
        <label for="question-${index}">${q.label}${q.required ? '<span class="required">*</span>' : ''}</label>
        ${q.type === 'select' ? `
          <select id="question-${index}" name="${q.name}" ${q.required ? 'required' : ''}>
            <option value="" disabled selected>Select...</option>
            ${q.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
          </select>
        ` : `
          <input 
            type="${q.type}" 
            id="question-${index}" 
            name="${q.name}" 
            placeholder="${q.placeholder || ''}"
            ${q.required ? 'required' : ''}
            ${q.pattern ? `pattern="${q.pattern}"` : ''}
          >
        `}
        ${q.description ? `<div class="question-hint">${q.description}</div>` : ''}
      </div>
    `;
  });

  widget.innerHTML = `
    <button class="feedback-button" aria-label="Leave feedback">
      <span class="button-icon">📝</span>
    </button>
    <div class="feedback-modal" role="dialog" aria-labelledby="feedback-title" aria-modal="true">
      <div class="feedback-header">
        <span class="title" id="feedback-title">${title}</span>
        <button class="close-modal" aria-label="Close">&times;</button>
      </div>
      <form class="feedback-form" novalidate>
        <textarea 
          placeholder="${placeholder}" 
          rows="4" 
          required
          aria-required="true"
        ></textarea>
        <div class="custom-questions">${questionsHTML}</div>
        <button type="submit" class="submit-feedback">
          <span class="button-text">Send</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
        <div class="feedback-message" aria-live="assertive" role="alert"></div>
      </form>
    </div>
    <div class="modal-overlay"></div>
  `;
  document.body.appendChild(widget);

  // Elementy DOM
  const openBtn = widget.querySelector('.feedback-button');
  const modal = widget.querySelector('.feedback-modal');
  const overlay = widget.querySelector('.modal-overlay');
  const closeBtn = widget.querySelector('.close-modal');
  const submitBtn = widget.querySelector('.submit-feedback');
  const form = widget.querySelector('.feedback-form');
  const textarea = widget.querySelector('textarea');
  const messageBox = widget.querySelector('.feedback-message');
  const spinner = submitBtn.querySelector('.spinner');
  const firstFocusable = textarea;
  let lastFocusable = submitBtn;

  // Obsługa focus trap
  function handleFocusTrap(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  // Funkcje zarządzania modalem
  function openModal() {
    document.body.style.overflow = 'hidden';
    modal.classList.add('open');
    overlay.classList.add('open');
    
    setTimeout(() => {
      modal.classList.add('visible');
      overlay.classList.add('visible');
      firstFocusable.focus();
      loadDraft();
    }, 10);
    
    modal.addEventListener('keydown', handleFocusTrap);
  }

  function closeModal() {
    modal.classList.remove('visible');
    overlay.classList.remove('visible');
    
    setTimeout(() => {
      modal.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }, 300);
    
    modal.removeEventListener('keydown', handleFocusTrap);
  }

  // Obsługa przycisków
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // Zamknięcie na ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // Komunikaty
  function showMessage(msg, isError = false) {
    messageBox.textContent = msg;
    messageBox.className = `feedback-message ${isError ? 'error' : 'success'}`;
    messageBox.style.display = 'block';

    setTimeout(() => {
      messageBox.style.opacity = '0';
      setTimeout(() => {
        messageBox.style.display = 'none';
        messageBox.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  // Zarządzanie draftami
  function saveDraft() {
    const draft = {
      feedback: textarea.value,
    };
    
    customQuestions.forEach((q, index) => {
      const element = widget.querySelector(`#question-${index}`);
      draft[`q${index}`] = element.value;
    });
    
    window[storage].setItem('feedbackDraft', JSON.stringify(draft));
  }

  function loadDraft() {
    const draft = JSON.parse(window[storage].getItem('feedbackDraft'));
    if (draft) {
      textarea.value = draft.feedback || '';
      customQuestions.forEach((q, index) => {
        const element = widget.querySelector(`#question-${index}`);
        if (element && draft[`q${index}`]) {
          element.value = draft[`q${index}`];
        }
      });
    }
  }

  function removeDraft() {
    window[storage].removeItem('feedbackDraft');
  }

  // Nasłuchiwanie zmian
  textarea.addEventListener('input', saveDraft);
  customQuestions.forEach((q, index) => {
    const element = widget.querySelector(`#question-${index}`);
    element.addEventListener('input', saveDraft);
  });

  // Walidacja formularza
  function validateForm() {
    let isValid = true;
    
    // Walidacja głównego pola
    if (!textarea.value.trim()) {
      textarea.setCustomValidity('Please enter your feedback');
      isValid = false;
    } else {
      textarea.setCustomValidity('');
    }
    
    // Walidacja niestandardowych pól
    customQuestions.forEach((q, index) => {
      const element = widget.querySelector(`#question-${index}`);
      const value = element.value.trim();
      
      if (q.required && !value) {
        element.setCustomValidity('This field is required');
        isValid = false;
      } 
      else if (q.type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) {
        element.setCustomValidity('Please enter a valid email');
        isValid = false;
      }
      else {
        element.setCustomValidity('');
      }
      
      // Pokaż błąd
      element.reportValidity();
    });
    
    return isValid;
  }

  // Obsługa wysyłania
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showMessage('Please complete all required fields', true);
      return;
    }

    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    const buttonText = submitBtn.querySelector('.button-text');
    buttonText.textContent = 'Sending...';

    const data = {
      feedback: textarea.value.trim(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      user_agent: navigator.userAgent
    };

    // Zbieranie odpowiedzi na niestandardowe pytania
    customQuestions.forEach((q, index) => {
      const element = widget.querySelector(`#question-${index}`);
      data[q.name] = element.value;
    });

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Request failed');
      }

      // Reset form
      form.reset();
      removeDraft();
      
      closeModal();
      showMessage('Thank you! Your feedback has been sent.');
    } catch (err) {
      console.error('Feedback error:', err);
      const errorMsg = err.message.includes('NetworkError') 
        ? 'Network error. Please check your connection.' 
        : 'Failed to send feedback. Please try again.';
      showMessage(errorMsg, true);
    } finally {
      spinner.style.display = 'none';
      buttonText.textContent = 'Send';
      submitBtn.disabled = false;
    }
  });
})();
