<script setup>
import { ref } from 'vue'

const email = 'suportepandaapi@gmail.com'
const copied = ref(false)

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section id="time" class="team-section page-shell">
    <h2 class="team-title">Código aberto, <span>feito para colaborar</span></h2>

    <div class="team-grid">
      <article class="team-card">
        <div class="team-avatar">
          <img src="https://github.com/ajayxr.png" alt="Anderson Jader" />
        </div>

        <h3 class="team-name">Anderson Jader</h3>
        <p class="team-role">Criador do PandaAPI</p>

        <div class="team-stack">
          <div class="team-stack-row"><span>Site</span><strong>Vue 3 · Vite · Express</strong></div>
          <div class="team-stack-row"><span>API</span><strong>.NET 10 · ASP.NET Core</strong></div>
          <div class="team-stack-row"><span>Extensão</span><strong>Vue · JavaScript</strong></div>
          <div class="team-stack-row"><span>Infra</span><strong>Railway · Cloudflare</strong></div>
        </div>

        <div class="team-contact">
          <div class="team-contact-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Sugestões e contato
          </div>
          <p class="team-contact-text">Ideia de melhoria, bug ou dúvida? Escreva pra gente.</p>
          <div class="team-mail">
            <a :href="`mailto:${email}`">{{ email }}</a>
            <button class="team-copy" type="button" :aria-label="copied ? 'E-mail copiado' : 'Copiar e-mail'" @click="copyEmail">
              <span v-if="copied">✓</span>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
        </div>

        <div class="team-links">
          <a class="team-icon" href="https://github.com/ajayxr" target="_blank" rel="noopener" aria-label="GitHub">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          </a>
          <a class="team-icon" href="https://www.linkedin.com/in/anderson-j-710685235/" target="_blank" rel="noopener" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
        </div>
      </article>

      <div class="team-code" aria-hidden="true">
        <div class="window-top">
          <span class="window-lights"><i></i><i></i><i></i></span>
          <span class="window-title">open-source.js</span>
          <span class="window-menu">···</span>
        </div>
        <div class="code-content">
          <div class="code-line"><span class="line-number">01</span><span><span class="code-dim">// código aberto, feito para colaborar</span></span></div>
          <div class="code-line"><span class="line-number">02</span><span><b>const</b> projeto = {</span></div>
          <div class="code-line"><span class="line-number">03</span><span>&nbsp;&nbsp;<em>licenca</em>: <u>'MIT'</u>,</span></div>
          <div class="code-line"><span class="line-number">04</span><span>&nbsp;&nbsp;<em>repos</em>: [<u>'PandaAPI.extension'</u>, <u>'PandaAPI.web'</u>, <u>'PandaAPI'</u>],</span></div>
          <div class="code-line"><span class="line-number">05</span><span>&nbsp;&nbsp;<em>contribuir</em>: [<u>'issues'</u>, <u>'pull requests'</u>, <u>'ideias'</u>],</span></div>
          <div class="code-line"><span class="line-number">06</span><span>&nbsp;&nbsp;<em>contato</em>: <u>'suportepandaapi@gmail.com'</u>,</span></div>
          <div class="code-line"><span class="line-number">07</span><span>}</span></div>
          <div class="code-line"><span class="line-number">08</span><span><span class="code-dim">// como contribuir</span></span></div>
          <div class="code-line"><span class="line-number">09</span><span><span class="code-dim">// 1. faça um fork do repositório</span></span></div>
          <div class="code-line"><span class="line-number">10</span><span><span class="code-dim">// 2. crie uma branch com a sua ideia</span></span></div>
          <div class="code-line"><span class="line-number">11</span><span><span class="code-dim">// 3. abra um pull request</span></span></div>
          <div class="code-line"><span class="line-number">12</span><span>projeto.<i>colaboracao</i> <span class="code-dim">//</span> <span class="code-result">'aberta a todos'</span></span></div>
        </div>
        <div class="code-bottom">
          <span><i class="status-pulse"></i> ONLINE</span>
          <span>aberto a colaboração</span>
        </div>
      </div>
    </div>

    <div class="team-actions">
      <a class="button button-primary extension-store-button" href="https://github.com/ajayxr/PandaAPI.web" target="_blank" rel="noopener noreferrer">
        Contribuir no GitHub <span aria-hidden="true">↗</span>
      </a>
      <a class="button extension-store-button extension-store-button-secondary" href="https://github.com/ajayxr/PandaAPI.web/issues" target="_blank" rel="noopener noreferrer">
        Sugerir uma ferramenta <span aria-hidden="true">↗</span>
      </a>
    </div>
  </section>
</template>