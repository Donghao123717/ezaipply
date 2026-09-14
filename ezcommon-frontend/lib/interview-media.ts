"use client"

/**
 * Camera, microphone and the officer's voice for the mock interview.
 *
 * A real consular interview is spoken, through a window, with someone watching
 * you. Practising it by typing removes the two things that actually make it
 * hard: hearing the question once and answering out loud under a stranger's
 * gaze. This is what makes the rehearsal resemble the thing.
 *
 * Kept out of the component so permission handling and cleanup live in one
 * place - a camera or mic track left running after the interview ends is a
 * light on someone's laptop that will not go out.
 */

export type MediaPermission = 'idle' | 'prompting' | 'granted' | 'denied' | 'unsupported'

export function mediaSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

/**
 * Ask for camera and microphone together.
 *
 * Browsers only prompt in response to a gesture, and only on a secure origin,
 * so this is always called from a button rather than on mount - a permission
 * dialog nobody asked for gets dismissed, and a dismissed dialog is a denial
 * the browser remembers.
 */
export async function requestMedia(video: boolean): Promise<MediaStream> {
  if (!mediaSupported()) throw new Error('unsupported')
  return navigator.mediaDevices.getUserMedia({
    // Stated rather than left to the browser's defaults. Echo cancellation is
    // wanted here even though it costs a little playback brightness: without
    // it the officer's question bleeds into the microphone and gets
    // transcribed as part of the applicant's answer, which turns the
    // consistency check into nonsense.
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
  })
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

/**
 * Voices load asynchronously, and the first call to getVoices() usually
 * returns an empty list. Speaking before they arrive means the browser picks
 * its own default - on macOS often a low-bitrate compact voice - which is why
 * the officer sounded muffled. Resolve once, cache, and reuse.
 */
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady
  voicesReady = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) return resolve(existing)
    const done = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    // Some browsers never fire the event if the list was already warm.
    setTimeout(done, 1200)
  })
  return voicesReady
}

/**
 * The clearest available voice for a language.
 *
 * Ranked rather than "first match", because the first match is frequently a
 * novelty voice (Bad News, Bubbles, Zarvox on macOS) or a compact one. Named
 * high-quality voices win, then any non-compact local voice, then whatever is
 * left - and a female-default like Samantha or Google US English is both the
 * clearest and closest to a real consular window.
 */
const PREFERRED = ['samantha', 'google us english', 'google uk english', 'microsoft aria', 'microsoft jenny', 'siri', 'ava', 'allison', 'karen', 'daniel']
const AVOID = /bad news|bubbles|boing|jester|organ|cellos|good news|trinoids|whisper|wobble|zarvox|albert|bells|superstar|novelty|eloquence/i

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const prefix = lang.slice(0, 2).toLowerCase()
  const candidates = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix) && !AVOID.test(v.name))
  if (!candidates.length) return voices.find((v) => v.lang?.toLowerCase().startsWith(prefix))
  for (const want of PREFERRED) {
    const hit = candidates.find((v) => v.name.toLowerCase().includes(want))
    if (hit) return hit
  }
  // Enhanced/premium variants carry the suffix in their name on macOS.
  return (
    candidates.find((v) => /enhanced|premium|natural|neural/i.test(v.name)) ||
    candidates.find((v) => v.localService === false) ||
    candidates[0]
  )
}

/**
 * Read the officer's question aloud.
 *
 * Browser speech synthesis rather than a backend voice: it is instant, costs
 * nothing, and works offline. The point is that the applicant hears the
 * question once, at speed, the way they will on the day.
 */
export function speak(text: string, lang = 'en-US', onState?: (speaking: boolean) => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onState?.(false)
    return
  }
  void loadVoices()
    .then((voices) => {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      // Drives the interviewer's mouth, so it moves only while audio is playing.
      utterance.onstart = () => onState?.(true)
      utterance.onend = () => onState?.(false)
      utterance.onerror = () => onState?.(false)
      // Consular officers are brisk, but a rate above 1 blurs consonants on
      // compact voices, and an applicant who mishears the question is
      // rehearsing the wrong thing. Just under natural pace stays realistic
      // and stays intelligible.
      utterance.rate = 0.97
      utterance.pitch = 1
      utterance.volume = 1
      const voice = pickVoice(voices, lang)
      if (voice) utterance.voice = voice
      window.speechSynthesis.speak(utterance)
    })
    .catch(() => {
      // A missing voice pack should never interrupt the interview.
      onState?.(false)
    })
}

export function stopSpeaking(onState?: (speaking: boolean) => void): void {
  onState?.(false)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* nothing to cancel */
  }
}

/** Records one answer and hands back the audio. */
export function createRecorder(stream: MediaStream, onDone: (blob: Blob) => void): MediaRecorder {
  // Record audio only: the officer hears you, and sending video would cost the
  // applicant bandwidth for nothing.
  const audioOnly = new MediaStream(stream.getAudioTracks())
  const recorder = new MediaRecorder(audioOnly)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.onstop = () => onDone(new Blob(chunks, { type: 'audio/webm' }))
  return recorder
}
