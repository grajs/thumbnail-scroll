import WebThumbnail from '../index'
import html2canvas from 'html2canvas'

const createImage = () => html2canvas(document.querySelector('.target'), {
  allowTaint: true,
  x: 0,
  y: 0
}).then(canvas => {
  const customImage = document.createElement('img')
  customImage.src = canvas.toDataURL()
  return customImage
})

createImage().then(customImage => {
  const thumbnail = new WebThumbnail({
    mode: 'image',
    customImage,
    className: 'scroll',
    size: 200,
    skeleton: { 'target-item': '#ffddaa' }
  })
  window.addEventListener('resize', () => {
    createImage().then(image => thumbnail.reRender(image))
  })
})
