// Array utilities
export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Device detection - checks both user agent and screen width
export function isMobile() {
  const isMobileDevice = /Mobi|Android/i.test(navigator.userAgent);
  const isNarrowScreen = window.innerWidth < 768; // md breakpoint
  return isMobileDevice || isNarrowScreen;
}
