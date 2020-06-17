import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  mode: 'skeleton',
  className: 'scroll',
  size: 200,
  skeleton: { 'target-item': '#ffddaa' }
})

window.addEventListener('resize', () => thumbnail.refreshRect())
