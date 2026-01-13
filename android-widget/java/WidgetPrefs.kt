package com.anonymous.bathroomcounter.widget

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object WidgetPrefs {
  const val PREFS_NAME = "BathroomWidgetPrefs"

  const val KEY_QUEUED_EVENTS = "queued_events"
  const val KEY_LAST_TAP_MS = "last_tap_ms"
  const val KEY_SUMMARY_DATE = "summary_date"
  const val KEY_SUMMARY_PEE = "summary_pee"
  const val KEY_SUMMARY_POOP = "summary_poop"
  const val KEY_LAST_PEE = "last_pee_ts"
  const val KEY_LAST_POOP = "last_poop_ts"
  const val KEY_ICON_PEE = "icon_pee"
  const val KEY_ICON_POOP = "icon_poop"
  const val KEY_THEME_ID = "theme_id"
  const val KEY_THEME_MODE = "theme_mode"
  const val KEY_WIDGET_BG_COLOR = "widget_bg_color"
  const val KEY_WIDGET_CARD_COLOR = "widget_card_color"
  const val KEY_WIDGET_TEXT_COLOR = "widget_text_color"
  const val KEY_WIDGET_MUTED_COLOR = "widget_muted_color"
  const val KEY_WIDGET_ACCENT_COLOR = "widget_accent_color"
  const val KEY_WIDGET_ACCENT_TEXT_COLOR = "widget_accent_text_color"
  const val KEY_WIDGET_OPACITY = "widget_opacity"
  const val KEY_TIME_FORMAT = "time_format"
  const val KEY_LAST_LABEL = "last_label"

  const val DEFAULT_PEE_ICON = "\uD83D\uDCA7"
  const val DEFAULT_POOP_ICON = "\uD83D\uDCA9"
  const val DEFAULT_TIME_FORMAT = "24h"
  const val DEFAULT_LAST_LABEL = "Last"

  val DEFAULT_BG_COLOR: Int = Color.parseColor("#F6F2EC")
  val DEFAULT_CARD_COLOR: Int = Color.parseColor("#FFFFFF")
  val DEFAULT_TEXT_COLOR: Int = Color.parseColor("#2A2622")
  val DEFAULT_MUTED_COLOR: Int = Color.parseColor("#6E655E")
  val DEFAULT_ACCENT_COLOR: Int = Color.parseColor("#4E7F6C")
  val DEFAULT_ACCENT_TEXT_COLOR: Int = Color.parseColor("#FFFFFF")

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun dateKey(ts: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date(ts))
  }

  fun formatTime(ts: Long, timeFormat: String): String {
    if (ts <= 0L) {
      return "--"
    }
    val pattern = if (timeFormat == "12h") "h:mm a" else "HH:mm"
    val formatter = SimpleDateFormat(pattern, Locale.getDefault())
    return formatter.format(Date(ts))
  }
}
