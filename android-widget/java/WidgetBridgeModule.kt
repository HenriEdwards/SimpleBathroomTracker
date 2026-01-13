package com.anonymous.bathroomcounter.widget

import android.graphics.Color
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetBridgeModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WidgetBridge"

  @ReactMethod
  fun getQueuedEvents(promise: Promise) {
    val prefs = WidgetPrefs.prefs(reactContext)
    val raw = prefs.getString(WidgetPrefs.KEY_QUEUED_EVENTS, "[]") ?: "[]"
    promise.resolve(raw)
  }

  @ReactMethod
  fun clearQueuedEvents(promise: Promise) {
    val prefs = WidgetPrefs.prefs(reactContext)
    prefs.edit().putString(WidgetPrefs.KEY_QUEUED_EVENTS, "[]").apply()
    promise.resolve(null)
  }

  @ReactMethod
  fun setWidgetSettingsMirror(
    iconPee: String,
    iconPoop: String,
    themeId: String,
    themeMode: String,
    widgetOpacity: Double,
    timeFormat: String,
    lastLabel: String,
    bgColor: String,
    cardColor: String,
    textColor: String,
    mutedColor: String,
    accentColor: String,
    accentTextColor: String,
    promise: Promise
  ) {
    val prefs = WidgetPrefs.prefs(reactContext)
    prefs.edit()
      .putString(WidgetPrefs.KEY_ICON_PEE, iconPee)
      .putString(WidgetPrefs.KEY_ICON_POOP, iconPoop)
      .putString(WidgetPrefs.KEY_THEME_ID, themeId)
      .putString(WidgetPrefs.KEY_THEME_MODE, themeMode)
      .putFloat(WidgetPrefs.KEY_WIDGET_OPACITY, widgetOpacity.toFloat())
      .putString(WidgetPrefs.KEY_TIME_FORMAT, timeFormat)
      .putString(WidgetPrefs.KEY_LAST_LABEL, lastLabel)
      .putInt(
        WidgetPrefs.KEY_WIDGET_BG_COLOR,
        parseColor(bgColor, WidgetPrefs.DEFAULT_BG_COLOR)
      )
      .putInt(
        WidgetPrefs.KEY_WIDGET_CARD_COLOR,
        parseColor(cardColor, WidgetPrefs.DEFAULT_CARD_COLOR)
      )
      .putInt(
        WidgetPrefs.KEY_WIDGET_TEXT_COLOR,
        parseColor(textColor, WidgetPrefs.DEFAULT_TEXT_COLOR)
      )
      .putInt(
        WidgetPrefs.KEY_WIDGET_MUTED_COLOR,
        parseColor(mutedColor, WidgetPrefs.DEFAULT_MUTED_COLOR)
      )
      .putInt(
        WidgetPrefs.KEY_WIDGET_ACCENT_COLOR,
        parseColor(accentColor, WidgetPrefs.DEFAULT_ACCENT_COLOR)
      )
      .putInt(
        WidgetPrefs.KEY_WIDGET_ACCENT_TEXT_COLOR,
        parseColor(accentTextColor, WidgetPrefs.DEFAULT_ACCENT_TEXT_COLOR)
      )
      .apply()
    BathroomWidgetProvider.updateAllWidgets(reactContext)
    promise.resolve(null)
  }

  @ReactMethod
  fun setWidgetSummary(
    todayDate: String,
    peeCount: Int,
    poopCount: Int,
    lastPeeTs: Double,
    lastPoopTs: Double,
    promise: Promise
  ) {
    val prefs = WidgetPrefs.prefs(reactContext)
    prefs.edit()
      .putString(WidgetPrefs.KEY_SUMMARY_DATE, todayDate)
      .putInt(WidgetPrefs.KEY_SUMMARY_PEE, peeCount)
      .putInt(WidgetPrefs.KEY_SUMMARY_POOP, poopCount)
      .putLong(WidgetPrefs.KEY_LAST_PEE, lastPeeTs.toLong())
      .putLong(WidgetPrefs.KEY_LAST_POOP, lastPoopTs.toLong())
      .apply()
    BathroomWidgetProvider.updateAllWidgets(reactContext)
    promise.resolve(null)
  }

  private fun parseColor(value: String?, fallback: Int): Int {
    if (value.isNullOrBlank()) {
      return fallback
    }
    return try {
      Color.parseColor(value)
    } catch (e: IllegalArgumentException) {
      fallback
    }
  }
}
