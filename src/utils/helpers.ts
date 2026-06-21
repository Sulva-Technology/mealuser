export const formatNGN = (kobo: number): string => {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(naira);
};

export const isSlotAvailable = (slotTime: string, targetDateStr: string, mockCurrentTimeInMins?: number): boolean => {
  const dateSplit = targetDateStr.split('-');
  const year = parseInt(dateSplit[0]);
  const month = parseInt(dateSplit[1]) - 1;
  const day = parseInt(dateSplit[2]);

  const targetDate = new Date(year, month, day);
  const now = new Date();
  
  const targetMidnight = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

  if (targetMidnight > todayMidnight) {
    return true; 
  }
  if (targetMidnight < todayMidnight) {
    return false; 
  }

  const slotSplit = slotTime.split(':');
  const slotHour = parseInt(slotSplit[0]);
  const slotMin = parseInt(slotSplit[1]);

  let currentHour = now.getHours();
  let currentMin = now.getMinutes();

  if (mockCurrentTimeInMins !== undefined) {
    currentHour = Math.floor(mockCurrentTimeInMins / 60);
    currentMin = mockCurrentTimeInMins % 60;
  }

  const slotMinutes = slotHour * 60 + slotMin;
  const currentMinutes = currentHour * 60 + currentMin;

  return (slotMinutes - currentMinutes) >= 60;
};
