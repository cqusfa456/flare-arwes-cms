/** @jsx jsx */

import lerna from '../../../../lerna.json'

window.noxtron.setupPlayground(({ emotion }) => {
  const { jsx } = emotion
  return {
    element: document.querySelector('#root'),
    basePath: '/play/',
    assetsPath: '/play/noxtron/',
    playgroundPath: '/play/',
    sandboxPath: '/play/sandbox/',
    codeLanguage: 'typescript',
    title: {
      small: (
        <img
          style={{ display: 'block', margin: 0, height: '0.9em' }}
          src="/assets/images/logotype.svg"
          alt="ARWES Playground"
          title={`ARWES v${lerna.version}`}
        />
      )
    },
    theme: {
      typographyCommons: {
        heading: {
          fontFamily: '"Titillium Web", sans-serif',
          fontWeight: '300',
          textTransform: 'uppercase'
        },
        body: {
          fontFamily: '"Titillium Web", sans-serif',
          fontWeight: '300'
        },
        cta: {
          fontFamily: '"Titillium Web", sans-serif',
          fontWeight: '300',
          textTransform: 'uppercase'
        },
        code: {
          fontFamily: '"Source Code Pro", Menlo, Monaco, "Courier New", monospace',
          fontWeight: '300'
        }
      },
      colorHues: {
        primary: 180,
        secondary: 60
      },
      colorSchemeDisabled: true
    },
    getTypeDefinitions: () => import('./typeDefinitions.js').then((m) => m.typeDefinitions),
    getSandboxes: () => import('./sandboxes.js').then((m) => m.sandboxes)
  }
})
