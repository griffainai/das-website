/* ================================================================
   SCOUT — Driver Appreciation Solutions AI Chat Widget
   Self-contained vanilla JS. No external dependencies.
   Calls the DAS Portal chat API with streaming.
   ================================================================ */

;(function () {
  'use strict'

  // ── Config ────────────────────────────────────────────────────
  // Point this at wherever the das-portal is deployed.
  const API_URL        = 'https://das-portal-ten.vercel.app/api/chat'
  const SUBMIT_URL     = 'https://das-portal-ten.vercel.app/api/chat/submit-quote'
  const SESSION_KEY    = 'das_scout_messages'
  const PULSE_DELAY_MS = 10000   // show unread dot after 10s

  // ── State ─────────────────────────────────────────────────────
  let isOpen      = false
  let isStreaming  = false
  let messages     = []          // { role, content }[]
  let quotePending = null
  let abortCtrl    = null

  const WELCOME = {
    role:    'assistant',
    content: "Hey there! 👋 I'm **Scout**, your Driver Appreciation Solutions guide.\n\nI help fleet teams pick the right recognition gifts, build custom quotes, and plan full-year programs. What can I help you with today?",
  }

  const QUICK_REPLIES = [
    { icon: '🎁', text: 'Help me pick appreciation gifts' },
    { icon: '📋', text: 'Get a custom quote'              },
    { icon: '📅', text: 'Plan a full-year program'        },
    { icon: '❓', text: 'I have a question'               },
  ]

  // ── Restore session ───────────────────────────────────────────
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    messages = saved ? JSON.parse(saved) : [WELCOME]
  } catch {
    messages = [WELCOME]
  }

  function saveSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)) } catch {}
  }

  // ── Markdown → HTML (minimal) ─────────────────────────────────
  function md(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p style="margin-top:6px">')
      .replace(/\n/g, '<br>')
  }

  // ── Parse <quote_data>...</quote_data> ────────────────────────
  function parseQuote(text) {
    const m = text.match(/<quote_data>([\s\S]*?)<\/quote_data>/)
    if (!m) return { clean: text, quote: null }
    try {
      return {
        clean: text.replace(/<quote_data>[\s\S]*?<\/quote_data>/g, '').trim(),
        quote: JSON.parse(m[1].trim()),
      }
    } catch { return { clean: text, quote: null } }
  }

  // ── CSS (injected once) ───────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('das-scout-styles')) return
    const style = document.createElement('style')
    style.id = 'das-scout-styles'
    style.textContent = `
      #das-scout-btn {
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        display: flex; align-items: center; gap: 10px;
        background: #1A2E6E; color: #fff;
        border: none; border-radius: 100px;
        padding: 14px 22px; cursor: pointer;
        font-family: inherit; font-size: 14px; font-weight: 600;
        box-shadow: 0 8px 24px rgba(26,46,110,.35);
        transition: background 200ms, transform 150ms;
      }
      #das-scout-btn:hover  { background: #112050; }
      #das-scout-btn:active { transform: scale(.97); }
      #das-scout-btn svg    { width: 20px; height: 20px; flex-shrink: 0; }
      .das-scout-pulse {
        position: absolute; top: -3px; right: -3px;
        width: 12px; height: 12px; background: #C8A84B;
        border-radius: 50%; border: 2px solid #1A2E6E;
      }

      #das-scout-panel {
        position: fixed; bottom: 94px; right: 24px; z-index: 9999;
        width: 380px; height: 560px; max-height: calc(100dvh - 110px);
        background: #fff; border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,.18);
        border: 1px solid rgba(0,0,0,.07);
        display: flex; flex-direction: column; overflow: hidden;
        transform-origin: bottom right;
        transition: transform 250ms cubic-bezier(.34,1.56,.64,1), opacity 200ms;
      }
      #das-scout-panel.hidden {
        transform: scale(.92) translateY(10px);
        opacity: 0; pointer-events: none;
      }

      #das-scout-header {
        background: #1A2E6E; padding: 14px 16px;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      .das-scout-hinfo { display: flex; align-items: center; gap: 12px; }
      .das-scout-hicon {
        width: 36px; height: 36px; background: rgba(255,255,255,.15);
        border-radius: 10px; display: flex; align-items: center; justify-content: center;
      }
      .das-scout-hicon svg { width: 18px; height: 18px; }
      .das-scout-hname  { color: #fff; font-weight: 700; font-size: 14px; }
      .das-scout-hstatus {
        display: flex; align-items: center; gap: 5px;
        color: rgba(255,255,255,.55); font-size: 11px; margin-top: 2px;
      }
      .das-scout-hstatus span { width: 6px; height: 6px; background: #4ade80; border-radius: 50%; }
      #das-scout-close {
        width: 30px; height: 30px; background: none; border: none; cursor: pointer;
        color: rgba(255,255,255,.5); border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        transition: background 150ms, color 150ms;
      }
      #das-scout-close:hover { background: rgba(255,255,255,.1); color: #fff; }
      #das-scout-close svg { width: 16px; height: 16px; }

      #das-scout-msgs {
        flex: 1; overflow-y: auto; padding: 16px;
        background: #F8F9FB; display: flex; flex-direction: column; gap: 12px;
        scroll-behavior: smooth;
      }
      #das-scout-msgs::-webkit-scrollbar { width: 4px; }
      #das-scout-msgs::-webkit-scrollbar-thumb { background: #DEE3E9; border-radius: 4px; }

      .das-msg { display: flex; align-items: flex-end; gap: 8px; }
      .das-msg.user { flex-direction: row-reverse; }
      .das-msg-avatar {
        width: 28px; height: 28px; background: #1A2E6E; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .das-msg-avatar svg { width: 14px; height: 14px; color: #fff; }
      .das-msg-bubble {
        max-width: 78%; border-radius: 18px; padding: 10px 14px;
        font-size: 13.5px; line-height: 1.5;
      }
      .das-msg.user   .das-msg-bubble { background: #1A2E6E; color: #fff; border-bottom-right-radius: 4px; }
      .das-msg.assist .das-msg-bubble { background: #fff; color: #1F2937; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.08); border: 1px solid #EAECEF; }

      .das-typing { display: flex; gap: 4px; padding: 2px 4px; }
      .das-typing span {
        width: 7px; height: 7px; background: #9CA3AF; border-radius: 50%;
        animation: das-bounce 900ms infinite;
      }
      .das-typing span:nth-child(2) { animation-delay: 150ms; }
      .das-typing span:nth-child(3) { animation-delay: 300ms; }
      @keyframes das-bounce {
        0%,60%,100% { transform: translateY(0); }
        30%          { transform: translateY(-6px); }
      }

      .das-quick-replies { display: flex; flex-direction: column; gap: 8px; padding-left: 36px; }
      .das-quick-btn {
        background: #fff; border: 1px solid #DEE3E9;
        border-radius: 12px; padding: 10px 14px;
        font-size: 13px; font-family: inherit; cursor: pointer;
        text-align: left; color: #374151; font-weight: 500;
        display: flex; align-items: center; gap: 8px;
        transition: border-color 150ms, background 150ms;
        box-shadow: 0 1px 2px rgba(0,0,0,.05);
      }
      .das-quick-btn:hover { border-color: rgba(26,46,110,.4); background: rgba(26,46,110,.03); }

      .das-quote-card {
        background: #EEF3FF; border: 1px solid rgba(26,46,110,.2);
        border-radius: 16px; padding: 16px;
      }
      .das-quote-title  { font-size: 13px; font-weight: 700; color: #1A2E6E; margin-bottom: 10px; }
      .das-quote-items  { font-size: 12px; color: #4B5563; margin-bottom: 12px; line-height: 1.9; }
      .das-quote-submit {
        width: 100%; background: #1A2E6E; color: #fff;
        border: none; border-radius: 12px; padding: 10px;
        font-size: 13px; font-weight: 700; cursor: pointer;
        font-family: inherit; transition: background 150ms;
      }
      .das-quote-submit:hover    { background: #112050; }
      .das-quote-submit:disabled { opacity: .5; cursor: default; }
      .das-quote-note { text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 6px; }
      .das-quote-email-wrap { margin-bottom: 10px; }
      .das-quote-email-label { display: block; font-size: 11px; font-weight: 500; color: #6B7280; margin-bottom: 4px; }
      .das-quote-email-req   { color: #EF4444; }
      .das-quote-email-hint  { font-size: 10px; color: #9CA3AF; margin-top: 3px; }
      .das-quote-email-input {
        width: 100%; border: 1px solid #DEE3E9; border-radius: 8px;
        padding: 7px 10px; font-size: 12.5px; font-family: inherit;
        outline: none; box-sizing: border-box;
        transition: border-color 150ms, box-shadow 150ms;
      }
      .das-quote-email-input:focus { border-color: #1A2E6E; box-shadow: 0 0 0 3px rgba(26,46,110,.1); }

      #das-scout-input-wrap {
        padding: 12px; border-top: 1px solid #F0F0F0;
        background: #fff; flex-shrink: 0;
      }
      .das-scout-input-row { display: flex; gap: 8px; }
      #das-scout-input {
        flex: 1; border: 1px solid #DEE3E9; border-radius: 12px;
        padding: 10px 14px; font-size: 13.5px; font-family: inherit;
        outline: none; transition: border-color 150ms, box-shadow 150ms;
      }
      #das-scout-input:focus  { border-color: #1A2E6E; box-shadow: 0 0 0 3px rgba(26,46,110,.1); }
      #das-scout-input:disabled { background: #F9FAFB; color: #9CA3AF; }
      #das-scout-send {
        width: 40px; height: 40px; background: #1A2E6E; border: none;
        border-radius: 12px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; flex-shrink: 0;
        transition: background 150ms; color: #fff;
      }
      #das-scout-send:hover    { background: #112050; }
      #das-scout-send:disabled { opacity: .35; cursor: default; }
      #das-scout-send svg { width: 16px; height: 16px; }
      .das-scout-footer { text-align: center; font-size: 10px; color: #D1D5DB; margin-top: 6px; letter-spacing: .03em; }

      @media (max-width: 440px) {
        #das-scout-panel { width: calc(100vw - 24px); right: 12px; bottom: 88px; }
        #das-scout-btn   { right: 12px; bottom: 12px; }
      }
    `
    document.head.appendChild(style)
  }

  // ── SVG icons ─────────────────────────────────────────────────
  const ICON_TRUCK = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>`
  const ICON_X    = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`
  const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>`

  // ── DOM ───────────────────────────────────────────────────────
  let panelEl, msgsEl, inputEl, sendEl, quickRepliesEl, typingEl, quotePendingEl

  function buildDOM() {
    // Button
    const btn = document.createElement('button')
    btn.id = 'das-scout-btn'
    btn.setAttribute('aria-label', 'Chat with Scout')
    btn.innerHTML = `<div style="position:relative">${ICON_TRUCK}<div class="das-scout-pulse" id="das-pulse" style="display:none"></div></div><span>Chat with Scout</span>`
    btn.addEventListener('click', toggleChat)
    document.body.appendChild(btn)

    // Panel
    const panel = document.createElement('div')
    panel.id = 'das-scout-panel'
    panel.classList.add('hidden')
    panel.innerHTML = `
      <div id="das-scout-header">
        <div class="das-scout-hinfo">
          <div class="das-scout-hicon">${ICON_TRUCK}</div>
          <div>
            <div class="das-scout-hname">Scout</div>
            <div class="das-scout-hstatus"><span></span>Driver Appreciation Solutions</div>
          </div>
        </div>
        <button id="das-scout-close" aria-label="Close">${ICON_X}</button>
      </div>
      <div id="das-scout-msgs"></div>
      <div id="das-scout-input-wrap">
        <div class="das-scout-input-row">
          <input id="das-scout-input" type="text" placeholder="Ask Scout anything…" autocomplete="off" />
          <button id="das-scout-send" aria-label="Send">${ICON_SEND}</button>
        </div>
        <div class="das-scout-footer">Powered by Driver Appreciation Solutions · AI may make errors</div>
      </div>
    `
    document.body.appendChild(panel)
    panelEl = panel

    msgsEl  = panel.querySelector('#das-scout-msgs')
    inputEl = panel.querySelector('#das-scout-input')
    sendEl  = panel.querySelector('#das-scout-send')

    panel.querySelector('#das-scout-close').addEventListener('click', () => toggleChat(false))
    sendEl.addEventListener('click', () => sendMessage(inputEl.value))
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputEl.value) }
    })

    // Render initial messages
    renderAll()

    // Pulse after delay
    setTimeout(() => {
      const pulse = document.getElementById('das-pulse')
      if (pulse && !isOpen) pulse.style.display = 'block'
    }, PULSE_DELAY_MS)
  }

  // ── Render helpers ────────────────────────────────────────────
  function renderAll() {
    msgsEl.innerHTML = ''
    messages.forEach((m, i) => appendMessage(m, i))
    if (messages.length === 1) renderQuickReplies()
    scrollBottom()
  }

  function appendMessage(msg, index) {
    const wrap = document.createElement('div')
    wrap.className = `das-msg ${msg.role === 'user' ? 'user' : 'assist'}`
    wrap.dataset.index = index

    if (msg.role === 'assistant') {
      wrap.innerHTML = `<div class="das-msg-avatar">${ICON_TRUCK}</div><div class="das-msg-bubble"><p>${md(msg.content)}</p></div>`
    } else {
      wrap.innerHTML = `<div class="das-msg-bubble">${escHtml(msg.content)}</div>`
    }
    msgsEl.appendChild(wrap)
  }

  function appendTyping() {
    const wrap = document.createElement('div')
    wrap.className = 'das-msg assist'
    wrap.id = 'das-typing-row'
    wrap.innerHTML = `<div class="das-msg-avatar">${ICON_TRUCK}</div><div class="das-msg-bubble"><div class="das-typing"><span></span><span></span><span></span></div></div>`
    msgsEl.appendChild(wrap)
    scrollBottom()
    return wrap
  }

  function removeTyping() {
    const el = document.getElementById('das-typing-row')
    if (el) el.remove()
  }

  function renderQuickReplies() {
    const wrap = document.createElement('div')
    wrap.className = 'das-quick-replies'
    wrap.id = 'das-qr'
    QUICK_REPLIES.forEach(qr => {
      const btn = document.createElement('button')
      btn.className = 'das-quick-btn'
      btn.innerHTML = `<span>${qr.icon}</span><span>${escHtml(qr.text)}</span>`
      btn.addEventListener('click', () => { wrap.remove(); sendMessage(qr.text) })
      wrap.appendChild(btn)
    })
    msgsEl.appendChild(wrap)
    scrollBottom()
  }

  function renderQuoteCard(quote) {
    // Remove existing card if any
    const existing = document.getElementById('das-quote-card')
    if (existing) existing.remove()

    const card = document.createElement('div')
    card.id = 'das-quote-card'
    card.className = 'das-quote-card'

    const items = [
      quote.type              && `🏷️ <strong>Program:</strong> ${escHtml(quote.type)}`,
      quote.driver_count      && `👥 <strong>Drivers:</strong> ${quote.driver_count}`,
      quote.budget_per_driver && `💵 <strong>Budget:</strong> $${quote.budget_per_driver}/driver`,
      quote.timeline          && `📅 <strong>Timeline:</strong> ${escHtml(quote.timeline)}`,
      quote.contact_name      && `👤 <strong>Contact:</strong> ${escHtml(quote.contact_name)}`,
      quote.contact_email     && `✉️ <strong>Email:</strong> ${escHtml(quote.contact_email)}`,
    ].filter(Boolean).join('<br>')

    // Show email input only when Scout didn't collect one
    const needsEmail  = !quote.contact_email
    const emailSection = needsEmail ? `
      <div class="das-quote-email-wrap">
        <label class="das-quote-email-label">Your email <span class="das-quote-email-req">*</span></label>
        <input id="das-quote-email" class="das-quote-email-input" type="email" placeholder="you@company.com" autocomplete="email" />
        <div class="das-quote-email-hint">So our team can send your quote</div>
      </div>
    ` : ''

    card.innerHTML = `
      <div class="das-quote-title">📋 Your Quote Summary</div>
      <div class="das-quote-items">${items}</div>
      ${emailSection}
      <button class="das-quote-submit" id="das-submit-btn" ${needsEmail ? 'disabled' : ''}>Submit Quote Request →</button>
      <div class="das-quote-note">Our team responds within 1 business day</div>
    `
    msgsEl.appendChild(card)

    // Enable submit only once a valid email is typed
    if (needsEmail) {
      const emailInput = card.querySelector('#das-quote-email')
      const submitBtn  = card.querySelector('#das-submit-btn')
      emailInput.addEventListener('input', function () {
        submitBtn.disabled = !this.value.trim() || !this.value.includes('@')
      })
    }

    card.querySelector('#das-submit-btn').addEventListener('click', async function () {
      this.disabled    = true
      this.textContent = 'Submitting…'

      // Merge in manual email if Scout didn't collect one
      const finalQuote = Object.assign({}, quote)
      if (needsEmail) {
        const emailInput = card.querySelector('#das-quote-email')
        if (emailInput) finalQuote.contact_email = emailInput.value.trim()
      }

      await submitQuote(finalQuote)
      card.remove()
      pushMessage({
        role:    'assistant',
        content: '✅ **Quote submitted!** Our team will review and follow up within 1 business day. Is there anything else I can help with?',
      })
    })
    scrollBottom()
  }

  // ── Messaging ─────────────────────────────────────────────────
  function pushMessage(msg) {
    messages.push(msg)
    saveSession()
    appendMessage(msg, messages.length - 1)
    scrollBottom()
  }

  async function sendMessage(content) {
    if (!content.trim() || isStreaming) return
    inputEl.value = ''
    setStreaming(true)

    // Remove quick replies
    const qr = document.getElementById('das-qr')
    if (qr) qr.remove()

    // Push user message
    pushMessage({ role: 'user', content: content.trim() })

    // Show typing indicator
    const typingRow = appendTyping()

    abortCtrl && abortCtrl.abort()
    abortCtrl = new AbortController()

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages }),
        signal:  abortCtrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(res.status)

      removeTyping()

      // Add streaming assistant message
      const idx = messages.length
      messages.push({ role: 'assistant', content: '' })
      appendMessage(messages[idx], idx)
      const bubble = msgsEl.querySelector(`.das-msg[data-index="${idx}"] .das-msg-bubble`)

      const reader    = res.body.getReader()
      const decoder   = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        messages[idx].content = accumulated
        if (bubble) bubble.innerHTML = `<p>${md(accumulated)}</p>`
        scrollBottom()
      }

      // Parse quote
      const { clean, quote } = parseQuote(accumulated)
      messages[idx].content = clean
      if (bubble) bubble.innerHTML = `<p>${md(clean)}</p>`
      if (quote) renderQuoteCard(quote)
      saveSession()
    } catch (err) {
      removeTyping()
      if (err.name !== 'AbortError') {
        pushMessage({
          role:    'assistant',
          content: "Sorry, I'm having a connection issue. Try again in a moment or email **support@driverappreciationsolutions.com**.",
        })
      }
    } finally {
      setStreaming(false)
    }
  }

  async function submitQuote(quote) {
    try {
      await fetch(SUBMIT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(quote),
      })
    } catch {}
  }

  // ── UI helpers ────────────────────────────────────────────────
  function toggleChat(forceOpen) {
    isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen
    if (isOpen) {
      panelEl.classList.remove('hidden')
      const pulse = document.getElementById('das-pulse')
      if (pulse) pulse.style.display = 'none'
      setTimeout(() => inputEl && inputEl.focus(), 200)
    } else {
      panelEl.classList.add('hidden')
    }
  }

  function setStreaming(v) {
    isStreaming  = v
    inputEl.disabled = v
    sendEl.disabled  = v
    inputEl.placeholder = v ? 'Scout is typing…' : 'Ask Scout anything…'
  }

  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  function init() {
    injectStyles()
    buildDOM()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
