import { renderAlert } from '../alert.template'
import { renderLogo } from '../components/logo.template'

export interface RegisterPageData {
  error?: string
}

export function renderRegisterPage(data: RegisterPageData): string {
  return `
    <!DOCTYPE html>
    <html lang="en" class="h-full dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register - Sci-Fi CMS</title>
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

        .register-card {
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
          <h2 class="mt-6 text-xl font-medium text-white">Create Your Account</h2>
          <p class="mt-2 text-sm text-zinc-400">Get started with Sci-Fi CMS</p>
        </div>

        <!-- Form Container -->
        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div class="relative">
            <!-- Glow effect behind card -->
            <div class="absolute -inset-1 rounded-2xl bg-gradient-to-b from-scifi-500/20 via-transparent to-cyan-500/10 blur-xl"></div>

            <div class="register-card relative rounded-xl border border-white/10 px-6 py-8 sm:px-10 shadow-2xl shadow-scifi-500/5">
              <!-- Alerts -->
              ${data.error ? `<div class="mb-6">${renderAlert({ type: 'error', message: data.error })}</div>` : ''}

              <!-- Form -->
              <form
                id="register-form"
                hx-post="/auth/register/form"
                hx-target="#form-response"
                hx-swap="innerHTML"
                class="space-y-6"
              >
                <!-- First and Last Name -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="firstName" class="block text-sm font-medium text-zinc-300 mb-2">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                      placeholder="First name"
                    >
                  </div>
                  <div>
                    <label for="lastName" class="block text-sm font-medium text-zinc-300 mb-2">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                      placeholder="Last name"
                    >
                  </div>
                </div>

                <!-- Username -->
                <div>
                  <label for="username" class="block text-sm font-medium text-zinc-300 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                    placeholder="Choose a username"
                  >
                </div>

                <!-- Email -->
                <div>
                  <label for="email" class="block text-sm font-medium text-zinc-300 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    required
                    class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                    placeholder="Enter your email"
                  >
                </div>

                <!-- Password -->
                <div>
                  <label for="password" class="block text-sm font-medium text-zinc-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="new-password"
                    required
                    minlength="8"
                    class="w-full rounded-lg bg-zinc-900/80 px-3.5 py-2.5 text-sm text-white shadow-sm border border-white/10 placeholder:text-zinc-500 focus:outline-none focus:border-scifi-500/50 focus:ring-1 focus:ring-scifi-500/50 transition-all"
                    placeholder="Create a password (min. 8 characters)"
                  >
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  class="w-full rounded-lg bg-gradient-to-r from-scifi-500 to-scifi-400 px-4 py-2.5 text-sm font-semibold text-white hover:from-scifi-600 hover:to-scifi-500 focus:outline-none focus:ring-2 focus:ring-scifi-500 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-all shadow-lg shadow-scifi-500/25"
                >
                  Create Account
                </button>
              </form>

              <!-- Links -->
              <div class="mt-6 text-center">
                <p class="text-sm text-zinc-400">
                  Already have an account?
                  <a href="/auth/login" class="font-semibold text-scifi-400 hover:text-scifi-300 transition-colors">Sign in here</a>
                </p>
              </div>

              <div id="form-response"></div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}