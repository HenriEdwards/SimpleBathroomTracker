package com.anonymous.bathroomcounter.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.anonymous.bathroomcounter.MainActivity
import com.anonymous.bathroomcounter.R
import java.util.Calendar
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

class BathroomWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_ADD_PEE -> handleAdd(context, "pee")
      ACTION_ADD_POO -> handleAdd(context, "poop")
      ACTION_MIDNIGHT_UPDATE -> {
        updateAllWidgets(context)
      }
    }
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }
    scheduleMidnightUpdate(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: android.os.Bundle
  ) {
    updateAppWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    private const val ACTION_ADD_PEE = "com.anonymous.bathroomcounter.widget.ACTION_ADD_PEE"
    private const val ACTION_ADD_POO = "com.anonymous.bathroomcounter.widget.ACTION_ADD_POO"
    private const val ACTION_MIDNIGHT_UPDATE =
      "com.anonymous.bathroomcounter.widget.ACTION_MIDNIGHT_UPDATE"

    private const val REQUEST_OPEN_APP = 100
    private const val REQUEST_ADD_PEE = 101
    private const val REQUEST_ADD_POO = 102
    private const val REQUEST_MIDNIGHT_UPDATE = 103
    private const val COMPACT_HEIGHT_DP = 100
    private const val TAP_DEBOUNCE_MS = 350L

    private fun handleAdd(context: Context, type: String) {
      val now = System.currentTimeMillis()
      if (shouldDebounce(context, now)) {
        return
      }
      queueEvent(context, type, now)
      updateSummary(context, type, now)
      updateAllWidgets(context)
    }

    private fun shouldDebounce(context: Context, now: Long): Boolean {
      val prefs = WidgetPrefs.prefs(context)
      val lastTap = prefs.getLong(WidgetPrefs.KEY_LAST_TAP_MS, 0L)
      if (now - lastTap < TAP_DEBOUNCE_MS) {
        return true
      }
      prefs.edit().putLong(WidgetPrefs.KEY_LAST_TAP_MS, now).apply()
      return false
    }

    private fun queueEvent(context: Context, type: String, ts: Long) {
      val prefs = WidgetPrefs.prefs(context)
      val raw = prefs.getString(WidgetPrefs.KEY_QUEUED_EVENTS, "[]") ?: "[]"
      val events = try {
        JSONArray(raw)
      } catch (_: Exception) {
        JSONArray()
      }
      val event = JSONObject()
      event.put("id", "widget-${UUID.randomUUID()}")
      event.put("type", type)
      event.put("ts", ts)
      events.put(event)
      prefs.edit().putString(WidgetPrefs.KEY_QUEUED_EVENTS, events.toString()).apply()
    }

    private fun updateSummary(context: Context, type: String, ts: Long) {
      val prefs = WidgetPrefs.prefs(context)
      val today = WidgetPrefs.dateKey(ts)
      val storedDate = prefs.getString(WidgetPrefs.KEY_SUMMARY_DATE, "") ?: ""
      var peeCount = prefs.getInt(WidgetPrefs.KEY_SUMMARY_PEE, 0)
      var poopCount = prefs.getInt(WidgetPrefs.KEY_SUMMARY_POOP, 0)
      var lastPeeTs = prefs.getLong(WidgetPrefs.KEY_LAST_PEE, 0L)
      var lastPoopTs = prefs.getLong(WidgetPrefs.KEY_LAST_POOP, 0L)

      if (storedDate != today) {
        peeCount = 0
        poopCount = 0
        lastPeeTs = 0L
        lastPoopTs = 0L
      }

      if (type == "pee") {
        peeCount += 1
        lastPeeTs = ts
      } else {
        poopCount += 1
        lastPoopTs = ts
      }

      prefs.edit()
        .putString(WidgetPrefs.KEY_SUMMARY_DATE, today)
        .putInt(WidgetPrefs.KEY_SUMMARY_PEE, peeCount)
        .putInt(WidgetPrefs.KEY_SUMMARY_POOP, poopCount)
        .putLong(WidgetPrefs.KEY_LAST_PEE, lastPeeTs)
        .putLong(WidgetPrefs.KEY_LAST_POOP, lastPoopTs)
        .apply()
    }

    private fun updateAppWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val prefs = WidgetPrefs.prefs(context)
      val iconPee = prefs.getString(WidgetPrefs.KEY_ICON_PEE, WidgetPrefs.DEFAULT_PEE_ICON)
        ?: WidgetPrefs.DEFAULT_PEE_ICON
      val iconPoop = prefs.getString(WidgetPrefs.KEY_ICON_POOP, WidgetPrefs.DEFAULT_POOP_ICON)
        ?: WidgetPrefs.DEFAULT_POOP_ICON
      val bgColor = prefs.getInt(WidgetPrefs.KEY_WIDGET_BG_COLOR, WidgetPrefs.DEFAULT_BG_COLOR)
      val cardColor = prefs.getInt(WidgetPrefs.KEY_WIDGET_CARD_COLOR, WidgetPrefs.DEFAULT_CARD_COLOR)
      val textColor = prefs.getInt(WidgetPrefs.KEY_WIDGET_TEXT_COLOR, WidgetPrefs.DEFAULT_TEXT_COLOR)
      val mutedColor = prefs.getInt(WidgetPrefs.KEY_WIDGET_MUTED_COLOR, WidgetPrefs.DEFAULT_MUTED_COLOR)
      val accentColor = prefs.getInt(WidgetPrefs.KEY_WIDGET_ACCENT_COLOR, WidgetPrefs.DEFAULT_ACCENT_COLOR)
      val accentTextColor = prefs.getInt(
        WidgetPrefs.KEY_WIDGET_ACCENT_TEXT_COLOR,
        WidgetPrefs.DEFAULT_ACCENT_TEXT_COLOR
      )
      val timeFormat = prefs.getString(WidgetPrefs.KEY_TIME_FORMAT, WidgetPrefs.DEFAULT_TIME_FORMAT)
        ?: WidgetPrefs.DEFAULT_TIME_FORMAT
      val lastLabel = prefs.getString(WidgetPrefs.KEY_LAST_LABEL, WidgetPrefs.DEFAULT_LAST_LABEL)
        ?: WidgetPrefs.DEFAULT_LAST_LABEL
      val lastPrefix = if (lastLabel.isBlank()) WidgetPrefs.DEFAULT_LAST_LABEL else lastLabel
      val storedDate = prefs.getString(WidgetPrefs.KEY_SUMMARY_DATE, "") ?: ""
      val today = WidgetPrefs.dateKey(System.currentTimeMillis())
      var peeCount = prefs.getInt(WidgetPrefs.KEY_SUMMARY_PEE, 0)
      var poopCount = prefs.getInt(WidgetPrefs.KEY_SUMMARY_POOP, 0)
      var lastPeeTs = prefs.getLong(WidgetPrefs.KEY_LAST_PEE, 0L)
      var lastPoopTs = prefs.getLong(WidgetPrefs.KEY_LAST_POOP, 0L)

      if (storedDate != today) {
        peeCount = 0
        poopCount = 0
        lastPeeTs = 0L
        lastPoopTs = 0L
      }

      val opacity = prefs.getFloat(WidgetPrefs.KEY_WIDGET_OPACITY, 1f).coerceIn(0.5f, 1f)
      val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
      val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
      val compact =
        (minHeight in 1..COMPACT_HEIGHT_DP) || (maxHeight in 1..COMPACT_HEIGHT_DP)
      val layoutId =
        if (compact) R.layout.bathroom_widget_compact else R.layout.bathroom_widget
      val views = RemoteViews(context.packageName, layoutId)
      views.setInt(R.id.widget_bg, "setColorFilter", bgColor)
      views.setInt(R.id.widget_pee_card_bg, "setColorFilter", cardColor)
      views.setInt(R.id.widget_poop_card_bg, "setColorFilter", cardColor)
      views.setInt(R.id.widget_pee_card_border, "setColorFilter", mutedColor)
      views.setInt(R.id.widget_poop_card_border, "setColorFilter", mutedColor)
      views.setInt(R.id.widget_home_icon_bg, "setColorFilter", accentColor)
      views.setInt(R.id.widget_home_icon, "setColorFilter", accentTextColor)
      views.setInt(R.id.widget_pee_plus_bg, "setColorFilter", accentColor)
      views.setInt(R.id.widget_poop_plus_bg, "setColorFilter", accentColor)
      views.setTextColor(R.id.widget_pee_icon, accentColor)
      views.setTextColor(R.id.widget_poop_icon, accentColor)
      views.setTextColor(R.id.widget_pee_count, accentColor)
      views.setTextColor(R.id.widget_poop_count, accentColor)
      views.setTextColor(R.id.widget_pee_plus_text, accentTextColor)
      views.setTextColor(R.id.widget_poop_plus_text, accentTextColor)
      views.setTextColor(R.id.widget_pee_last, mutedColor)
      views.setTextColor(R.id.widget_poop_last, mutedColor)
      views.setTextViewText(R.id.widget_pee_icon, iconPee)
      views.setTextViewText(R.id.widget_poop_icon, iconPoop)
      views.setTextViewText(R.id.widget_pee_count, peeCount.toString())
      views.setTextViewText(R.id.widget_poop_count, poopCount.toString())
      views.setTextViewText(
        R.id.widget_pee_last,
        "$lastPrefix: ${WidgetPrefs.formatTime(lastPeeTs, timeFormat)}"
      )
      views.setTextViewText(
        R.id.widget_poop_last,
        "$lastPrefix: ${WidgetPrefs.formatTime(lastPoopTs, timeFormat)}"
      )
      views.setFloat(R.id.widget_root, "setAlpha", opacity)

      if (!compact) {
        views.setTextColor(R.id.widget_pee_today_label, mutedColor)
        views.setTextColor(R.id.widget_poop_today_label, mutedColor)
      }

      val openIntent = Intent(context, MainActivity::class.java)
      val openPendingIntent = PendingIntent.getActivity(
        context,
        REQUEST_OPEN_APP,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_home_button, openPendingIntent)

      val addPeeIntent = Intent(context, BathroomWidgetProvider::class.java).apply {
        action = ACTION_ADD_PEE
      }
      val addPeePendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_ADD_PEE,
        addPeeIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_pee_add_button, addPeePendingIntent)

      val addPoopIntent = Intent(context, BathroomWidgetProvider::class.java).apply {
        action = ACTION_ADD_POO
      }
      val addPoopPendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_ADD_POO,
        addPoopIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_poop_add_button, addPoopPendingIntent)

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    fun updateAllWidgets(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val ids = appWidgetManager.getAppWidgetIds(
        ComponentName(context, BathroomWidgetProvider::class.java)
      )
      if (ids.isNotEmpty()) {
        ids.forEach { appWidgetId ->
          updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        scheduleMidnightUpdate(context)
      }
    }

    private fun scheduleMidnightUpdate(context: Context) {
      val calendar = Calendar.getInstance().apply {
        timeInMillis = System.currentTimeMillis()
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        add(Calendar.DAY_OF_MONTH, 1)
      }
      val intent = Intent(context, BathroomWidgetProvider::class.java).apply {
        action = ACTION_MIDNIGHT_UPDATE
      }
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_MIDNIGHT_UPDATE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
      alarmManager.set(
        android.app.AlarmManager.RTC_WAKEUP,
        calendar.timeInMillis,
        pendingIntent
      )
    }
  }
}
