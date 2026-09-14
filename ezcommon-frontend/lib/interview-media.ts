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
    audio: true,
    video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
  })
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

/**
 * Read the officer's question aloud.
 *
 * Browser speech synthesis rather than a backend voice: it is instant, costs
 * nothing, and works offline. The point is that the applicant hears the
 * question once, at speed, the way they will on the day - not that it sounds
 * like a particular person.
 */
export function speak(text: string, lang = 'en-US', onState?: (speaking: boolean) => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onState?.(false)
    return
  }
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    // Drives the interviewer's mouth, so it moves only while audio is playing.
    utterance.onstart = () => onState?.(true)
    utterance.onend = () => onState?.(false)
    utterance.onerror = () => onState?.(false)
    // Consular officers are brisk. A slow, friendly reading would teach the
    // wrong expectation.
    utterance.rate = 1.05
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith(lang.slice(0, 2)))
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  } catch {
    // A missing voice pack should never interrupt the interview.
    onState?.(false)
  }
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
