import { t } from '../../i18n/admin'
import { renderAlert } from '../alert.template'
import { renderLogo } from '../components/logo.template'

export interface LoginPageData {
  error?: string
  message?: string
  version?: string
  registrationEnabled?: boolean
}

export function renderLoginPage(data: LoginPageData, demoLoginActive: boolean = false): string {
  return `
    <!DOCTYPE html>
    <html lang="en" class="h-full dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - Sci-Fi CMS</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <script src="https://unpkg.com/htmx.org@2.0.3"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                scifi: {
                  400: '#fb923c',
                  500: '#f6821f',
                  600: '#ea680c'
                },
                error: '#ef4444'
              }
            }
          }
        }
      </script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        body {
          font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
        }

        .login-card {
          background: linear-gradient(135deg, rgba(246,130,31,0.06) 0%, rgba(24,24,27,1) 50%, rgba(34,211,238,0.04) 100%);
        }
      </style>
    </head>
    <body class="h-full bg-zinc-950">
      <!-- Dot grid background -->
      <div class="fixed inset-0 bg-[linear-gradient(rgba(246,130,31,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(246,130,31,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

      <div class="relative flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
        <!-- Logo Section -->
        <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div class="flex justify-center mb-8 text-white">
            ${renderLogo({ size: 'xl', variant: 'white' })}
          </div>
          <h2 class="mt-6 text-xl font-medium text-white">${t('Welcome Back')}</h2>
          <p class="mt-2 text-sm text-zinc-400">${t('Sign in to your account to continue')}</p>
        </div>

        <!-- Form Container -->
        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div class="relative">
            <!-- Glow effect behind card -->
            <div class="absolute -inset-1 rounded-2xl bg-gradient-to-b from-scifi-500/20 via-transparent to-cyan-500/10 blur-xl"></div>

            <div class="login-card relative rounded-xl border border-white/10 px-6 py-8 sm:px-10 shadow-2xl shadow-scifi-500/5">
              <!-- Alerts -->
              ${data.error ? `<div class="mb-6">${renderAlert({ type: 'error', message: data.error })}</div>` : ''}
              ${data.message ? `<div class="mb-6">${renderAlert({ type: 'success', message: data.message })}</div>` : ''}

              <!-- Form Response (HTMX target) -->
              <div id="form-response" class="mb-6"></div>

              <!-- Form -->
              <form
                id="login-form"
                hx-post="/auth/login/form"
                hx-target="#form-response"
                hx-swap="innerHTML"
                class="space-y-6"
              >
                <!-- Email -->
                <div>
                  <label for="email" class="block text-sm font-medium text-zinc-300 mb-2">
                    ${t('Email Address')}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    required
                    autofocus
                    class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                    placeholder="${t('Enter your email')}"
                  >
                </div>

                <!-- Password -->
                <div>
                  <label for="password" class="block text-sm font-medium text-zinc-300 mb-2">
                    ${t('Password')}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required
                    class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                    placeholder="${t('Enter your password')}"
                  >
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  class="w-full rounded-lg bg-gradient-to-r from-scifi-500 to-scifi-400 px-4 py-2.5 text-sm font-semibold text-white hover:from-scifi-600 hover:to-scifi-500 focus:outline-none focus:ring-2 focus:ring-scifi-500 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-all shadow-lg shadow-scifi-500/25"
                >
                  ${t('Sign In')}
                </button>
              </form>

              ${data.registrationEnabled ? `
              <!-- Links -->
              <div class="mt-6 text-center">
                <p class="text-sm text-zinc-400">
                  ${t("Don't have an account?")}
                  <a href="/auth/register" class="font-semibold text-scifi-400 hover:text-scifi-300 transition-colors">${t('Create one here')}</a>
                </p>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Version -->
          <div class="mt-6 text-center">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-scifi-500/10 text-scifi-400 ring-1 ring-inset ring-scifi-500/20">
              ${data.version || 'v0.1.0'}
            </span>
          </div>
        </div>
      </div>

      ${demoLoginActive ? `
      <script>
        // Demo Login Prefill Script
        (function() {
          'use strict';

          function prefillLoginForm() {
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            if (emailInput && passwordInput) {
              emailInput.value = 'admin@arwes.dev';
              passwordInput.value = 'arwes-admin!';

              // Add visual indication that form is prefilled (only if not already present)
              const form = emailInput.closest('form');
              if (form && !form.querySelector('.demo-mode-notice')) {
                const notice = document.createElement('div');
                notice.className = 'demo-mode-notice mb-6 rounded-lg bg-blue-500/10 p-4 ring-1 ring-blue-500/20';
                notice.innerHTML = '<div class="flex items-start gap-x-3"><svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><h3 class="text-sm font-semibold text-blue-300">Demo Mode</h3><p class="mt-1 text-sm text-blue-400">Login form prefilled with demo credentials</p></div></div>';
                form.insertBefore(notice, form.firstChild);
              }
            }
          }

          // Prefill on page load
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', prefillLoginForm);
          } else {
            prefillLoginForm();
          }

          // Also handle HTMX page changes (for SPA-like navigation)
          document.addEventListener('htmx:afterSwap', function(event) {
            if (event.detail.target.id === 'main-content' ||
                document.getElementById('email')) {
              setTimeout(prefillLoginForm, 100);
            }
          });
        })();
      </script>
      ` : ''}
    </body>
    </html>
  `
}