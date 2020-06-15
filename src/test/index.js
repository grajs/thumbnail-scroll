import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  mode: 'skeleton',
  className: 'scroll',
  scale: 0.05,
  skeleton: { 'target-item': '#ffddaa' }
})

window.addEventListener('resize', () => thumbnail.refreshRect())
