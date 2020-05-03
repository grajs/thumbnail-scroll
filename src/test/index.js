import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  target: document.querySelector('.target'),
  fullOrientation: 'width',
  mode: 'skeleton',
  className: 'scroll',
  skeletonClassName: 'target-item'
})

window.addEventListener('resize', () => thumbnail.refreshRect())
