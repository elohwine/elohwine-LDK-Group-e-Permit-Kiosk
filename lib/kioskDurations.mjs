export function remoteDurationSettings(kiosk) {
  if (!kiosk || !Object.prototype.hasOwnProperty.call(kiosk, 'durationOptions')) return null;
  if (!Array.isArray(kiosk.durationOptions)) throw new Error('Invalid remote duration options');
  for (const option of kiosk.durationOptions) {
    if (!option || !['', 'midnight'].includes(option.expiryMode || '')
      || (option.permitType !== 'permanent' && option.expiryMode !== 'midnight'
        && (typeof option.hours !== 'number' || !Number.isFinite(option.hours) || option.hours <= 0))) {
      throw new Error('Invalid remote duration choice');
    }
  }
  if (kiosk.defaultDurationHours !== null
    && (typeof kiosk.defaultDurationHours !== 'number' || !Number.isFinite(kiosk.defaultDurationHours) || kiosk.defaultDurationHours <= 0)) {
    throw new Error('Invalid remote default duration');
  }
  return {
    siteId: kiosk.siteId,
    kioskId: kiosk.id,
    hardwareId: kiosk.kioskId || null,
    kioskName: kiosk.kioskName || kiosk.name,
    defaultHours: kiosk.defaultDurationHours,
    expiryMode: kiosk.expireAtMidnight ? 'midnight' : '',
    durationOptions: kiosk.durationOptions,
    staticQrDurationHours: kiosk.staticQrDurationHours ?? null,
    durationConfigRevision: kiosk.durationConfigRevision || null,
  };
}

export function applyRemoteDurations(settings) {
  const remote = settings.remoteDurationConfig;
  if (!remote || remote.siteId !== settings.siteId
    || (remote.kioskId && settings.kioskId
      ? remote.kioskId !== settings.kioskId && remote.hardwareId !== settings.kioskId
      : remote.kioskName !== settings.kioskName)) return settings;
  const { siteId, kioskId, hardwareId, kioskName, ...durations } = remote;
  return { ...settings, ...durations };
}

export function durationDeliveryReport(settings, displayed) {
  const applied = applyRemoteDurations(settings);
  const revision = applied.durationConfigRevision || null;
  return {
    supported: true,
    appliedRevision: revision,
    displayedRevision: displayed?.siteId === settings.siteId
      && displayed?.kioskName === settings.kioskName ? displayed.revision : null,
    error: settings.durationConfigError || null,
  };
}

export function markDurationMenuLoaded(settings, storage) {
  if (!settings.durationConfigRevision) return;
  storage.setItem('kiosk_duration_menu', JSON.stringify({
    siteId: settings.siteId, kioskName: settings.kioskName, revision: settings.durationConfigRevision,
  }));
}

export function durationChoice(option, now = new Date()) {
  if (option.permitType === 'permanent' || (option.hours === null && option.expiryMode !== 'midnight')) {
    return { hours: null, indefinite: true, label: option.label || 'Indefinite (no expiry)' };
  }
  if (option.expiryMode === 'midnight') {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const localParts = (date) => Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
    const today = localParts(now);
    const target = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), 23, 59, 59);
    let end = target;
    // Resolve the UK offset at the end of the day, including DST transition days.
    for (let index = 0; index < 2; index += 1) {
      const parts = localParts(new Date(end));
      const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      end = target - (local - end);
    }
    return { hours: Math.max(0, end - now.getTime()) / 3600000, indefinite: false, label: option.label || 'Until Midnight' };
  }
  if (typeof option.hours !== 'number' || !Number.isFinite(option.hours) || option.hours <= 0) throw new Error('Invalid duration choice');
  return { hours: option.hours, indefinite: false, label: option.label || `${option.hours} hours` };
}
