import { createAnimatorSystem } from '@arwes/animator'
import { type FrameSettings, createFrame } from '@arwes/frames'

let active = false

const system = createAnimatorSystem()
const animator = system.register(undefined, {
  getSettings: () => ({ active, duration: { enter: 1, exit: 1 } })
})

const root = document.querySelector('#root')!
root.innerHTML = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"></svg>`

const svg = root.querySelector('svg')!

const settings: FrameSettings = {
  animator,
  elements: [
    {
      type: 'g',
      style: {
        transformOrigin: 'center',
        transformStyle: 'preserve-3d'
      },
      animatedSettings: { hideOnExited: false },
      animated: {
        initialStyle: { opacity: 0.2, scale: 0.75, rotateY: 0, perspective: '4cm' },
        transitions: {
          entering: { opacity: [0.2, 1, 0.6, 1], scale: 1, rotateY: 45, perspective: '4cm' },
          exiting: { opacity: [1, 0.2, 0.6, 0.2], scale: 0.75, rotateY: 0, perspective: '4cm' }
        }
      },
      elements: [
        {
          type: 'ellipse',
          style: {
            transformOrigin: 'center',
            fill: 'hsl(0 75% 50% / 0.1)',
            stroke: 'red',
            strokeWidth: '4'
          },
          animatedSettings: { hideOnExited: false },
          animated: {
            initialStyle: { strokeDasharray: '5px 5px', rotate: -180, y: 0 },
            transitions: {
              entering: { strokeDasharray: '15px 15px', rotate: 0, y: 8 },
              exiting: { strokeDasharray: '5px 5px', rotate: -180, y: 0 }
            }
          },
          cx: '50%',
          cy: '50%',
          rx: '50% - 8',
          ry: '50% - 8'
        },
        {
          type: 'ellipse',
          style: {
            transformOrigin: 'center',
            fill: 'hsl(60 75% 50% / 0.1)',
            stroke: 'yellow',
            strokeWidth: '8'
          },
          animatedSettings: { hideOnExited: false },
          animated: {
            initialStyle: { strokeDasharray: '10px 10px', rotate: -90, y: 0 },
            transitions: {
              entering: { strokeDasharray: '30px 30px', rotate: 0, y: 4 },
              exiting: { strokeDasharray: '10px 10px', rotate: -90, y: 0 }
            }
          },
          cx: '50%',
          cy: '50%',
          rx: '50% - 16 - 20',
          ry: '50% - 16 - 20'
        },
        {
          type: 'svg',
          viewBox: '0 0 24 24',
          x: '25%',
          y: '25%',
          width: '50%',
          height: '50%',
          style: { fill: 'yellow' },
          elements: `<path d="M12.702 2.19512L19.702 4.82012C20.0833 4.96305 20.4119 5.21897 20.6438 5.55368C20.8758 5.88838 21.0001 6.2859 21 6.69312V12.0561C21 13.7275 20.5346 15.366 19.6559 16.7878C18.7772 18.2096 17.52 19.3586 16.025 20.1061L12.671 21.7831C12.4627 21.8873 12.2329 21.9416 12 21.9416C11.7671 21.9416 11.5373 21.8873 11.329 21.7831L7.975 20.1061C6.48004 19.3586 5.22277 18.2096 4.34407 16.7878C3.46537 15.366 2.99996 13.7275 3 12.0561V6.69312C2.99995 6.2859 3.1242 5.88838 3.35615 5.55368C3.5881 5.21897 3.91669 4.96305 4.298 4.82012L11.298 2.19512C11.7506 2.02545 12.2494 2.02545 12.702 2.19512ZM12 4.06812L5 6.69312V12.0561C5.00023 13.356 5.36239 14.6301 6.04592 15.7358C6.72944 16.8414 7.70732 17.7349 8.87 18.3161L12 19.8831L15.13 18.3181C16.293 17.7367 17.2711 16.8429 17.9546 15.7369C18.6382 14.6309 19.0001 13.3563 19 12.0561V6.69312L12 4.06812ZM12 14.0001C12.2652 14.0001 12.5196 14.1055 12.7071 14.293C12.8946 14.4805 13 14.7349 13 15.0001C13 15.2653 12.8946 15.5197 12.7071 15.7072C12.5196 15.8948 12.2652 16.0001 12 16.0001C11.7348 16.0001 11.4804 15.8948 11.2929 15.7072C11.1054 15.5197 11 15.2653 11 15.0001C11 14.7349 11.1054 14.4805 11.2929 14.293C11.4804 14.1055 11.7348 14.0001 12 14.0001ZM12 7.00012C12.2652 7.00012 12.5196 7.10548 12.7071 7.29301C12.8946 7.48055 13 7.7349 13 8.00012V12.0001C13 12.2653 12.8946 12.5197 12.7071 12.7072C12.5196 12.8948 12.2652 13.0001 12 13.0001C11.7348 13.0001 11.4804 12.8948 11.2929 12.7072C11.1054 12.5197 11 12.2653 11 12.0001V8.00012C11 7.7349 11.1054 7.48055 11.2929 7.29301C11.4804 7.10548 11.7348 7.00012 12 7.00012Z"/>`
        }
      ]
    }
  ]
}

createFrame(svg, settings)

const update = (): void => {
  active = !active
  animator.send('update')
  setTimeout(update, active ? 3_000 : 1_500)
}

animator.send('setup')
update()
