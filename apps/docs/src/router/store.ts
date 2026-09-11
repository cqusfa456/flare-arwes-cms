import { atom } from 'jotai'

// Current pathname of the app. It is set by the Router component on the
// client side and initialized per page via the jotai Provider initialValues.
export const atomPathname = atom('/')
