'use client'

import { AR } from '@/ui'

export default (): JSX.Element => (
  <>
    <AR.Header>Audio Fundamentals</AR.Header>

    <AR.P>
      To feel an energetic and vibrant user experience, an app might want to include sound effects
      on events, notifications, transitions, interactions, or even music. ARWES provides a few tools
      to manage audio playback.
    </AR.P>

    <AR.H2>Bleeps</AR.H2>

    <AR.P>
      ARWES Bleeps can be used to manage beeps, bleeps, chimes, bells, typing, scanning, processing,
      or any kind of sounds. It is mostly recommended for short sound effects rather than playing
      long music or recording audio files. It is inspired by the{' '}
      <a href="https://howlerjs.com" target="_blank">
        Howler.js
      </a>{' '}
      library.
    </AR.P>

    <AR.P>
      Sounds are categorized by groups which can be configured accordingly such as relative volume
      or loading settings.
    </AR.P>

    <AR.UL>
      <li>
        <b>Background</b>: Ambient sounds with lowest volume.
      </li>
      <li>
        <b>Transition</b>: Sounds when UI elements enter or exit the app with low volume.
      </li>
      <li>
        <b>Interaction</b>: Sounds when user interacts with UI elements with medium volume.
      </li>
      <li>
        <b>Notification</b>: Sounds on events with high volume.
      </li>
      <li>
        <b>Voice</b>: Communication sounds with highest volume.
      </li>
    </AR.UL>

    <AR.P>
      For example, global app volume can be at 50% of current operative system volume, then relative
      by category, notifications/voice can be at 100% relative volume, interactions at 75%,
      transitions at 50%, and backgrounds at 25%.
    </AR.P>

    <AR.P>
      Normally, the audio files are loaded once per application and provided to all applicable
      components to play either declaratively or imperatively.
    </AR.P>

    <AR.H2>Accessibility</AR.H2>

    <AR.P>
      It mostly depends on the target audience of the app, for most cases, little or no sound
      effects is the recommended approach, but for others having sound feedback makes the experience
      more alive such as games and highly immersive experiences. First think about the audience
      before investing effort in sound effects.
    </AR.P>

    <AR.P>
      To prevent{' '}
      <a href="https://en.wikipedia.org/wiki/Sensory_overload" target="_blank">
        Sensory Overload
      </a>
      , sound effects should be meticulously selected (or designed) to create a non-invasive,
      non-intrusive, non-cumbersome experience throughout your app. The volume, the frequency, the
      timbre, reverb, the timing, the intensity, and many other factors are important to provide a
      pleasent experience to the user. It is recommended to allow the user to update sound settings
      to enable/disable them as preferred.
    </AR.P>

    <AR.P>
      Modern browsers have an{' '}
      <a href="https://developer.chrome.com/blog/web-audio-autoplay" target="_blank">
        Audio Playback Policy
      </a>{' '}
      to prevent web apps to intrusively play sounds until user properly interacts with it. If the
      app requires to have access for audio playback, having something like a mandatory entry screen
      and force the user to click/tap a button/icon to unlock audio playback can be an option.
    </AR.P>

    <AR.P>
      You can read{' '}
      <a href="https://m2.material.io/design/sound/about-sound.html" target="_blank">
        <b>Material Design v2 Sound guidelines</b>
      </a>{' '}
      for more recommendations.
    </AR.P>

    <AR.H2>Compatibility</AR.H2>

    <AR.P>
      First <code>.webm</code> and then <code>.mp3</code> audio file formats are recommended for
      cross-browser support and performance. <code>.webm</code> is supported in most browsers except
      in iOS. <code>.mp3</code> should be used as a fallback. <code>.wav</code> can be used for
      high-quality too. You can read more at{' '}
      <a
        href="https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers"
        target="_blank"
      >
        Media container formats
      </a>
      . ARWES provides ways to define and prioritize audio files to load and play.
    </AR.P>

    <AR.P>
      Feel free to use tools like{' '}
      <a href="https://www.audacityteam.org" target="_blank">
        Audacity
      </a>{' '}
      to export your audio files in the formats required and even adjust them.
    </AR.P>

    <AR.H2>Getting Sounds</AR.H2>

    <AR.P>
      Usually, unless there is an available sound designer, the sounds used are bought individually
      or in bundles from providers or services. There are many options and inspirations on the
      Internet. It takes time to define what are the requirements for a project and decide on which
      sounds to use.
    </AR.P>

    <AR.P>
      Download the{' '}
      <a href="https://m2.material.io/design/sound/sound-resources.html" target="_blank">
        Google Product Sounds
      </a>{' '}
      bundle of sounds for your own use as a starting point if you need.
    </AR.P>

    <AR.Navigation
      prevHref="/docs/develop/fundamentals/motion"
      prev="Motion"
      nextHref="/docs/develop/fundamentals/text"
      next="Text"
    />
  </>
)
