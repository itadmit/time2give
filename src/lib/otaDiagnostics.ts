import * as Updates from 'expo-updates';

/**
 * אבחון OTA מהמכשיר — מחזיר טקסט קריא עם המצב האמיתי + הלוגים של expo-updates.
 * זה מה ששובר את לולאת הניחושים: אם עדכון לא נכנס, הלוג יגיד למה
 * (rollback / crash בהחלה / channel לא נכון / runtimeVersion לא תואם).
 */
export async function getOtaDiagnostics(): Promise<string> {
  const lines: string[] = [];
  lines.push(`enabled: ${Updates.isEnabled}`);
  lines.push(`channel: ${Updates.channel ?? '—'}`);
  lines.push(`runtimeVersion: ${Updates.runtimeVersion ?? '—'}`);
  lines.push(`updateId: ${Updates.updateId ? Updates.updateId.slice(0, 8) : '(embedded)'}`);
  lines.push(`isEmbeddedLaunch: ${Updates.isEmbeddedLaunch}`);
  lines.push(`isEmergencyLaunch: ${Updates.isEmergencyLaunch}`);
  if (Updates.emergencyLaunchReason) lines.push(`emergencyReason: ${Updates.emergencyLaunchReason}`);
  lines.push(
    `createdAt: ${Updates.createdAt ? new Date(Updates.createdAt).toLocaleString('he-IL') : '—'}`,
  );

  // מה השרת אומר עכשיו
  try {
    const res = await Updates.checkForUpdateAsync();
    lines.push(`\nשרת: ${res.isAvailable ? 'עדכון זמין ✓' : 'אין עדכון חדש'}`);
    const mid = (res as any)?.manifest?.id;
    if (res.isAvailable && mid) lines.push(`serverUpdateId: ${String(mid).slice(0, 8)}`);
  } catch (e: any) {
    lines.push(`\nשרת: שגיאה — ${e?.message ?? String(e)}`);
  }

  // הלוגים האמיתיים של expo-updates מהמכשיר (שעה אחרונה) — כאן נראה rollback/crash אם קרה
  try {
    const entries = await Updates.readLogEntriesAsync(60 * 60 * 1000);
    if (entries.length) {
      lines.push('\n— לוג expo-updates —');
      entries.slice(-14).forEach((e) => {
        const t = new Date(e.timestamp).toLocaleTimeString('he-IL');
        lines.push(`${t} [${e.level}] ${e.code}: ${e.message}`);
      });
    } else {
      lines.push('\n(אין רשומות לוג בשעה האחרונה)');
    }
  } catch (e: any) {
    lines.push(`\n(לוג לא זמין: ${e?.message ?? String(e)})`);
  }

  return lines.join('\n');
}
