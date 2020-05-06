import './index.scss'

const getValuePx = value => +value.replace(/px$/, '')

export default class thumbnailScroll {
  constructor(option) {
    if (!option.target || option.target.nodeType !== 1) {
      throw '"option.target" should be a element'
      return
    }
    this.mergeOption(option)
    this.init()
  }

  mergeOption(optionData) {
    const option = Object.assign({
      parentElement: document.body,
      // skeleton || image
      mode: 'dom',
      size: 200,
      width: 200,
      height: 200,
      skeletonClassName: ''
    }, optionData)

    let {
      target,
      scrollLayer,
      scrollXLayer,
      scrollYLayer,
      scale,
      fullOrientation,
      width,
      height
    } = option

    if (scrollLayer) option.scrollXLayer = option.scrollYLayer = scrollLayer
    if (!scrollXLayer || scrollXLayer === window) option.scrollXLayer = document.documentElement
    if (!scrollYLayer || scrollYLayer === window) option.scrollYLayer = document.documentElement

    // 设置比例
    if (scale) {
      this.scale = scale
    } else {
      const { width: targetWidth, height: targetHeight } = target.getBoundingClientRect()
      if (!/^width|height$/.test(fullOrientation)) {
        fullOrientation = targetWidth > targetHeight ? 'height' : 'width'
      }
      this.scale = fullOrientation === 'width' ? width / targetWidth : height / targetHeight
    }
    this.option = option
    this.target = option.target
  }

  init() {
    const { target } = this.option
    const { width: targetWidth, height: targetHeight, x: targetLeft, y: targetTop } = target.getBoundingClientRect()
    this.targetWidth = targetWidth
    this.targetHeight = targetHeight
    this.targetLeft = targetLeft
    this.targetTop = targetTop
    this.boundaryScrollInterval = null
    this.createMap()
    this.createActiveRect()
    this.setEvent()
  }

  createMap() {
    const { mode, skeletonClassName, width, height, parentElement } = this.option
    const rootElement = document.createElement('div')
    rootElement.classList.add('thumbnail-scroll')
    rootElement.style.width = `${width}px`
    rootElement.style.height = `${height}px`
    parentElement && parentElement.appendChild(rootElement)
    this.el = rootElement

    if (mode === 'skeleton') {
      if (typeof skeletonClassName !== 'string') {
        throw '"option.skeletonClassName" should be a String'
        return
      }
      this.createSkeleton()
    }
  }

  createActiveRect() {
    const { scrollXLayer, scrollYLayer } = this.option
    const scale = this.scale

    const activeRect = document.createElement('div')
    activeRect.classList.add('thumbnail-scroll-rect')
    this.activeRect = activeRect
    this.el.appendChild(activeRect)

    const activeRectStyle = this.activeRect.style
    activeRectStyle.width = `${scrollXLayer.clientWidth * scale}px`
    activeRectStyle.height = `${scrollYLayer.clientHeight * scale}px`
    activeRectStyle.left = `${scrollXLayer.scrollLeft * scale}px`
    activeRectStyle.top = `${scrollYLayer.scrollTop * scale}px`
  }

  refreshRect() {
    const { size } = this.option
    const scale = this.scale
    const realScrollLayer = this.option.scrollXLayer
    const rectWidth = realScrollLayer.clientWidth * scale
    const rectHeight = realScrollLayer.clientHeight * scale
    const rectLeft = realScrollLayer.scrollLeft * scale
    const rectTop = realScrollLayer.scrollTop * scale
    const activeRectStyle = this.activeRect.style
    activeRectStyle.width = `${rectWidth}px`
    activeRectStyle.height = `${rectHeight}px`
    activeRectStyle.left = `${rectLeft}px`
    activeRectStyle.top = `${rectTop}px`
    // 判断缩略图能否上下移动
    if (this.fullDirectionX && rectTop + rectHeight > size) {
      this.translateY = -((rectTop + rectHeight - size) / this.scale)
      activeRectStyle.top = `${size - rectHeight}px`
    }
    // 判断缩略图能否左右移动
    if (!this.fullDirectionX && rectLeft + rectWidth > size) {
      this.translateX = -((rectLeft + rectWidth - size) / this.scale)
      activeRectStyle.left = `${size - rectWidth}px`
    }
    this.contentElement.style.transform = `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
  }

  createSkeleton() {
    const { width: targetWidth, height: targetHeight } = this.target.getBoundingClientRect()
    const content = document.createElement('div')
    content.classList.add('thumbnail-scroll-content', 'is-skeleton')
    content.style.width = `${targetWidth * this.scale}px`
    content.style.height = `${targetHeight * this.scale}px`
    this.el.appendChild(content)
    this.contentElement = content
    this.createSkeletonContent()
  }

  createSkeletonContent() {
    const { target, skeletonClassName } = this.option
    const scale = this.scale
    target.querySelectorAll(`.${skeletonClassName}`).forEach(item => {
      const { width: itemWidth, height: itemHeight, x: itemLeft, y: itemTop } = item.getBoundingClientRect()
      const skeletonItem = document.createElement('div')
      skeletonItem.classList.add('thumbnail-skeleton-item')
      const skeletonItemStyle = skeletonItem.style
      skeletonItemStyle.width = `${itemWidth * scale}px`
      skeletonItemStyle.height = `${itemHeight * scale}px`
      skeletonItemStyle.left = `${(itemLeft - this.targetLeft) * scale}px`
      skeletonItemStyle.top = `${(itemTop - this.targetTop) * scale}px`
      this.contentElement.appendChild(skeletonItem)
    })
  }

  stopBoundaryScroll() {
    if (!this.boundaryScrollInterval) return
    clearInterval(this.boundaryScrollInterval)
    this.boundaryScrollInterval = null
  }

  setBoundaryData() {
    const { size } = this.option
    const activeRect = this.activeRect
    const { width: contentWidth, height: contentHeight } = this.contentElement.getBoundingClientRect()
    const { width: rectWidth, height: rectHeight } = activeRect.getBoundingClientRect()
    const rectStyle = getComputedStyle(activeRect)
    const rectLeft = getValuePx(rectStyle.left)
    const rectTop = getValuePx(rectStyle.top)
    this.boundaryData = {
      left: rectLeft === 0 && this.translateX < 0 && this.rectMoveData.left,
      right: Math.abs(rectLeft - (size - rectWidth)) < 1 && this.translateX * this.scale > size - contentWidth && this.rectMoveData.right,
      top: rectTop === 0 && this.translateY < 0 && this.rectMoveData.top,
      bottom: Math.abs(rectTop - (size - rectHeight)) < 1 && this.translateY * this.scale > size - contentHeight && this.rectMoveData.bottom
    }
  }

  syncScroll() {
    const { left: rectLeft, top: rectTop } = getComputedStyle(this.activeRect)
    this.realScrollLayer.scrollLeft = -this.translateX + getValuePx(rectLeft) / this.scale
    this.realScrollLayer.scrollTop = -this.translateY + getValuePx(rectTop) / this.scale
  }

  // 偏移一定距离后是否会超出边界
  allowMove(direct, offsetValue) {
    const { width, height } = this.option
    const { width: contentWidth, height: contentHeight } = this.contentElement.getBoundingClientRect()
    // 往左偏移
    if (direct === 'left') {
      const maxLeft = (contentWidth - size) / this.scale
      return -this.translateX + offsetValue < maxLeft
    }
    // 往右偏移
    if (direct === 'right') {
      return -this.translateX > offsetValue
    }
    // 往上偏移
    if (direct === 'up') {
      const maxHeight = (contentHeight - size) / this.scale
      return -this.translateY + offsetValue < maxHeight
    }
    // 往下偏移
    if (direct === 'down') {
      return -this.translateY > offsetValue
    }
  }

  boundaryScroll() {
    const { size } = this.option
    const { width: contentWidth, height: contentHeight } = this.contentElement.getBoundingClientRect()
    const contentElement = this.contentElement
    const touchBoundary = () => this.boundaryData.left || this.boundaryData.right || this.boundaryData.top || this.boundaryData.bottom
    if (touchBoundary) {
      if (this.boundaryScrollInterval) return
      this.boundaryScrollInterval = setInterval(() => {
        if (this.boundaryData.left) {
          this.translateX = this.translateX + 3 / this.scale
          if (this.translateX > 0) {
            this.translateX = 0
            this.boundaryData.left = false
          }
        }
        if (this.boundaryData.top) {
          this.translateY = this.translateY + 3 / this.scale
          if (this.translateY > 0) {
            this.translateY = 0
            this.boundaryData.top = false
          }
        }
        if (this.boundaryData.right) {
          this.translateX = this.translateX - 3 / this.scale
          const maxLeft = -(contentWidth - size) / this.scale
          if (this.translateX < maxLeft) {
            this.translateX = Math.round(maxLeft)
            this.boundaryData.right = false
          }
        }
        if (this.boundaryData.bottom) {
          this.translateY = this.translateY - 3 / this.scale
          const maxTop = -(contentHeight - size) / this.scale
          if (this.translateY < maxTop) {
            this.translateY = Math.round(maxTop)
            this.boundaryData.bottom = false
          }
        }
        !touchBoundary() && this.stopBoundaryScroll()
        contentElement.style.transform = `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
      }, 20)
    } else {
      this.stopBoundaryScroll()
    }
  }

  // 拖动活动块
  setRectEvent() {
    const activeRect = this.activeRect
    let rectDragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.rectMoveData = {
      left: false,
      right: false,
      top: false,
      bottom: false
    }
    activeRect.addEventListener('mousedown', e => {
      if (e.button) return
      oldClientX = e.clientX
      oldClientY = e.clientY
      rectDragging = true
    })
    this.el.addEventListener('mousemove', e => {
      if (!rectDragging || e.button) return
      const offsetX = e.clientX - oldClientX
      const offsetY = e.clientY - oldClientY
      const { size } = this.option
      const { width: rectWidth, height: rectHeight } = activeRect.getBoundingClientRect()
      const activeRectStyle = getComputedStyle(activeRect)
      const rectLeft = getValuePx(activeRectStyle.left)
      const rectTop = getValuePx(activeRectStyle.top)
      let left = rectLeft + offsetX
      let top = rectTop + offsetY
      if (left < 0) left = 0
      if (top < 0) top = 0
      if (left + rectWidth > size) left = size - rectWidth
      if (top + rectHeight > size) top = size - rectHeight
      activeRect.style.left = `${left}px`
      activeRect.style.top = `${top}px`
      this.rectMoveData = {
        left: !(offsetX > 0),
        right: !(offsetX < 0),
        top: !(offsetY > 0),
        bottom: !(offsetY < 0)
      }
      this.setBoundaryData()
      this.boundaryScroll()
      oldClientX = e.clientX
      oldClientY = e.clientY
    })
    window.addEventListener('mouseup', e => {
      if (e.button) return
      if (rectDragging) {
        this.stopBoundaryScroll()
        this.scrollLock = true
        this.syncScroll()
        rectDragging = false
      }
    })
  }

  setScrollEvent() {
    const { scrollLayer, size } = this.option
    const realScrollLayer = this.realScrollLayer
    const contentElement = this.contentElement
    const activeRect = this.activeRect
    const { width: contentWidth, height: contentHeight } = contentElement.getBoundingClientRect()
    let oldScrollLeft = realScrollLayer.scrollLeft
    let oldScrollTop = realScrollLayer.scrollTop
    scrollLayer.addEventListener('scroll', () => {
      if (this.scrollLock) {
        oldScrollLeft = realScrollLayer.scrollLeft
        oldScrollTop = realScrollLayer.scrollTop
        this.scrollLock = false
        return
      }
      const maxLeft = (contentWidth - size) / this.scale
      const maxHeight = (contentHeight - size) / this.scale
      const offsetScrollLeft = realScrollLayer.scrollLeft - oldScrollLeft
      const offsetScrollTop = realScrollLayer.scrollTop - oldScrollTop

      // 往右滚动
      if (offsetScrollLeft > 0) {
        if (this.allowMove('left', offsetScrollLeft)) {
          this.translateX = this.translateX - offsetScrollLeft
        } else {
          const surplusX = maxLeft + this.translateX
          this.translateX = this.translateX - surplusX
          activeRect.style.left = `${getValuePx(activeRect.style.left) + (offsetScrollLeft - surplusX) * this.scale}px`
        }
      }
      // 内容区往右偏移
      if (offsetScrollLeft < 0) {
        if (this.allowMove('right', Math.abs(offsetScrollLeft))) {
          this.translateX = this.translateX - offsetScrollLeft
        } else {
          activeRect.style.left = `${getValuePx(activeRect.style.left) + (offsetScrollLeft - this.translateX) * this.scale}px`
          this.translateX = 0
        }
      }
      // 内容区向上偏移
      if (offsetScrollTop > 0) {
        if (this.allowMove('up', offsetScrollTop)) {
          this.translateY = this.translateY - offsetScrollTop
        } else {
          const surplusY = maxHeight + this.translateY
          this.translateY = this.translateY - surplusY
          activeRect.style.top = `${getValuePx(activeRect.style.top) + (offsetScrollTop - surplusY) * this.scale}px`
        }
      }
      // 内容区向下偏移
      if (offsetScrollTop < 0) {
        if (this.allowMove('down', Math.abs(offsetScrollTop))) {
          this.translateY = this.translateY - offsetScrollTop
        } else {
          activeRect.style.top = `${getValuePx(activeRect.style.top) + (offsetScrollTop - this.translateY) * this.scale}px`
          this.translateY = 0
        }
      }

      contentElement.style.transform = `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
      oldScrollLeft = realScrollLayer.scrollLeft
      oldScrollTop = realScrollLayer.scrollTop
    })
  }

  // 拖拽非活动块
  setDragMoveEvent() {
    const contentElement = this.contentElement
    let rootDragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.el.addEventListener('mousedown', e => {
      if (e.target !== this.el || e.button) return
      oldClientX = e.clientX
      oldClientY = e.clientY
      rootDragging = true
    })
    this.el.addEventListener('mousemove', e => {
      if (!rootDragging || e.button) return

      const offsetX = e.clientX - oldClientX
      let allowMoveX = false
      if (offsetX > 0 && this.allowMove('right', offsetX)) allowMoveX = true
      if (offsetX < 0 && this.allowMove('left', Math.abs(offsetX))) allowMoveX = true
      if (allowMoveX) this.translateX = this.translateX + offsetX / this.scale

      const offsetY = e.clientY - oldClientY
      let allowMoveY = false
      if (offsetY > 0 && this.allowMove('down', offsetY)) allowMoveY = true
      if (offsetY < 0 && this.allowMove('up', Math.abs(offsetY))) allowMoveY = true
      if (allowMoveY) this.translateY = this.translateY + offsetY / this.scale

      contentElement.style.transform = `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
      oldClientX = e.clientX
      oldClientY = e.clientY
    })
    window.addEventListener('mouseup', e => {
      if (e.button) return
      if (rootDragging) {
        rootDragging = false
        this.scrollLock = true
        this.syncScroll()
      }
    })
  }

  setEvent() {
    this.translateX = 0
    this.translateY = 0
    this.scrollLock = false
    this.setRectEvent()
    this.setDragMoveEvent()
    this.setScrollEvent()
  }
}
