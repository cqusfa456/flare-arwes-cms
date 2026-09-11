import { atomWithStorage } from 'jotai/utils'

export const atomMotionEnabled = atomWithStorage('motion', true)

export const atomAudioEnabled = atomWithStorage('audio', true)
