package com.thegreentangerine.gigbooks

import android.app.Application

/**
 * Stripped per S121 kill-Songs: the on-device click engine + track playback
 * + stem mixer (Oboe / SoundTouch / native C++) all retired with Songs. Media
 * Server (home) and Reaper (gig) own audio playback now. The cpp/ build still
 * produces a .so as a build-system artefact — left dormant; removal scheduled
 * for S122 Android NDK cleanup.
 */
class TangerineMediaApplication : Application()
