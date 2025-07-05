export function shuffleArray(array) {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

export function isImage(filePath) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  return imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext))
}

export function isVideo(filePath) {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext))
}
