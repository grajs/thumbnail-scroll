import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  mode: 'skeleton',
  className: 'scroll',
  skeleton: { 'target-item': '#ffddaa' }
})

window.addEventListener('resize', () => thumbnail.refreshRect())
