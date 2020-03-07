import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  target: document.querySelector('.target'),
  mode: 'skeleton',
  className: 'scroll',
  skeletonClassName: 'target-item'
})

window.addEventListener('resize', () => thumbnail.refreshRect())
