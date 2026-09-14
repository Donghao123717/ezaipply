/**
 * Where a signed-in student belongs.
 *
 * '/' is the public landing page, so every post-authentication redirect has to
 * name this explicitly. Three of them were still pointing at '/' after the
 * routes were split, which dropped users back onto marketing right after they
 * signed up - hence one constant rather than a literal at each call site.
 */
export const APP_HOME = '/home'
