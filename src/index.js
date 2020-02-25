import './index.scss'

const getValuePx = value => +value.replace(/px$/, '')

export default class thumbnailScroll {
  constructor(option) {
    if (option.target && option.target.nodeType === 1) {
      this.option = Object.assign({
        insertContainer: document.body,
        scrollLayer: window,
        // skeleton || dom || image
        mode: 'dom',
        className: '',
        resize: false,
        size: 200,
        skeletonClassName: ''
      }, option)
      this.init()
    } else {
      throw `"option.target" should be a element`
    }
  }

  init() {
    const { target, mode, skeletonClassName, size } = this.option
    const { width: targetWidth, height: targetHeight, x: targetLeft, y: targetTop } = target.getBoundingClientRect()
    this.targetWidth = targetWidth
    this.targetHeight = targetHeight
    this.targetLeft = targetLeft
    this.targetTop = targetTop
    this.fullDirectionX = targetHeight > targetWidth
    this.scale = size / (this.fullDirectionX ? targetWidth : targetHeight)
    this.contentTranslateX = 0
    this.contentTranslateY = 0
    this.boundaryScrollInterval = null
    this.realScrollLayer = this.option.scrollLayer === window ? document.documentElement : this.option.scrollLayer
    this.createRoot()
    if (mode === 'dom') {
      this.createCopyElement()
    }
    if (mode === 'skeleton') {
      if (skeletonClassName && typeof skeletonClassName === 'string') {
        this.createSkeleton()
      } else {
        throw `"option.skeletonClassName" should be a String`
      }
    }
    this.createActiveRectangle()
    this.setEvent()
  }

  createRoot() {
    const { className, size, insertContainer } = this.option
    const root = document.createElement('div')
    root.classList.add('thumbnail-scroll-container')
    if (className && typeof className === 'string') root.classList.add(className)
    if (size) root.style.height = root.style.width = `${size}px`
    insertContainer.appendChild(root)
    this.root = root
  }

  createActiveRectangle() {
    const activeRect = document.createElement('div')
    activeRect.classList.add('thumbnail-scroll-rect')
    this.root.appendChild(activeRect)
    this.activeRect = activeRect
    this.refreshRect()
  }

  refreshRect() {
    const { size } = this.option
    const scale = this.scale
    const realScrollLayer = this.realScrollLayer
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
      this.contentTranslateY = -((rectTop + rectHeight - size) / this.scale)
      activeRectStyle.top = `${size - rectHeight}px`
    }
    // 判断缩略图能否左右移动
    if (!this.fullDirectionX && rectLeft + rectWidth > size) {
      this.contentTranslateX = -((rectLeft + rectWidth - size) / this.scale)
      activeRectStyle.left = `${size - rectWidth}px`
    }
    this.contentElement.style.transform = `scale(${this.scale}) translate(${this.contentTranslateX}px, ${this.contentTranslateY}px)`
  }

  createCopyElement() {
    const { target } = this.option
    const content = target.cloneNode(true)
    content.classList.add('thumbnail-scroll-content')
    content.style.width = `${this.targetWidth}px`
    content.style.height = `${this.targetHeight}px`
    content.style.transform = `scale(${this.scale}) translate(0, 0)`
    this.root.appendChild(content)
    this.contentElement = content
  }

  createSkeleton() {
    const content = document.createElement('div')
    content.classList.add('thumbnail-scroll-content', 'is-skeleton')
    content.style.width = `${this.targetWidth}px`
    content.style.height = `${this.targetHeight}px`
    content.style.transform = `scale(${this.scale}) translate(0, 0)`
    this.root.appendChild(content)
    this.contentElement = content
    this.refreshSkeleton()
  }

  refreshSkeleton(init) {
    if (init) this.contentElement.innerHTML = ''
    const { target, skeletonClassName } = this.option
    target.querySelectorAll(`.${skeletonClassName}`).forEach(item => {
      const { width: itemWidth, height: itemHeight, x: itemLeft, y: itemTop } = item.getBoundingClientRect()
      const skeletonItem = document.createElement('div')
      skeletonItem.classList.add('skeleton-item')
      const skeletonItemStyle = skeletonItem.style
      skeletonItemStyle.width = `${itemWidth}px`
      skeletonItemStyle.height = `${itemHeight}px`
      skeletonItemStyle.left = `${itemLeft - this.targetLeft}px`
      skeletonItemStyle.top = `${itemTop - this.targetTop}px`
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
      left: rectLeft === 0 && this.contentTranslateX < 0 && this.rectMoveData.left,
      right: Math.abs(rectLeft - (size - rectWidth)) < 1 && this.contentTranslateX * this.scale > size - contentWidth && this.rectMoveData.right,
      top: rectTop === 0 && this.contentTranslateY < 0 && this.rectMoveData.top,
      bottom: Math.abs(rectTop - (size - rectHeight)) < 1 && this.contentTranslateY * this.scale > size - contentHeight && this.rectMoveData.bottom
    }
  }

  syncScroll() {
    const { left: rectLeft, top: rectTop } = getComputedStyle(this.activeRect)
    this.realScrollLayer.scrollLeft = -this.contentTranslateX + getValuePx(rectLeft) / this.scale
    this.realScrollLayer.scrollTop = -this.contentTranslateY + getValuePx(rectTop) / this.scale
  }

  // 偏移一定距离后是否会超出边界
  allowMove(direct, offsetValue) {
    const { size } = this.option
    const { width: contentWidth, height: contentHeight } = this.contentElement.getBoundingClientRect()
    // 往左偏移
    if (direct === 'left') {
      const maxLeft = (contentWidth - size) / this.scale
      return -this.contentTranslateX + offsetValue < maxLeft
    }
    // 往右偏移
    if (direct === 'right') {
      return -this.contentTranslateX > offsetValue
    }
    // 往上偏移
    if (direct === 'up') {
      const maxHeight = (contentHeight - size) / this.scale
      return -this.contentTranslateY + offsetValue < maxHeight
    }
    // 往下偏移
    if (direct === 'down') {
      return -this.contentTranslateY > offsetValue
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
          this.contentTranslateX = this.contentTranslateX + 3 / this.scale
          if (this.contentTranslateX > 0) {
            this.contentTranslateX = 0
            this.boundaryData.left = false
          }
        }
        if (this.boundaryData.top) {
          this.contentTranslateY = this.contentTranslateY + 3 / this.scale
          if (this.contentTranslateY > 0) {
            this.contentTranslateY = 0
            this.boundaryData.top = false
          }
        }
        if (this.boundaryData.right) {
          this.contentTranslateX = this.contentTranslateX - 3 / this.scale
          const maxLeft = -(contentWidth - size) / this.scale
          if (this.contentTranslateX < maxLeft) {
            this.contentTranslateX = Math.round(maxLeft)
            this.boundaryData.right = false
          }
        }
        if (this.boundaryData.bottom) {
          this.contentTranslateY = this.contentTranslateY - 3 / this.scale
          const maxTop = -(contentHeight - size) / this.scale
          if (this.contentTranslateY < maxTop) {
            this.contentTranslateY = Math.round(maxTop)
            this.boundaryData.bottom = false
          }
        }
        !touchBoundary() && this.stopBoundaryScroll()
        contentElement.style.transform = `scale(${this.scale}) translate(${this.contentTranslateX}px, ${this.contentTranslateY}px)`
      }, 20)
    } else {
      this.stopBoundaryScroll()
    }
  }

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
      this.scrollLock = true
    })
    this.root.addEventListener('mousemove', e => {
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
        this.syncScroll()
      }
      rectDragging = false
      setTimeout(() => this.scrollLock = false, 100)
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
        return
      }
      const maxLeft = (contentWidth - size) / this.scale
      const maxHeight = (contentHeight - size) / this.scale
      const offsetScrollLeft = realScrollLayer.scrollLeft - oldScrollLeft
      const offsetScrollTop = realScrollLayer.scrollTop - oldScrollTop

      // 往右滚动
      if (offsetScrollLeft > 0) {
        if (this.allowMove('left', offsetScrollLeft)) {
          this.contentTranslateX = this.contentTranslateX - offsetScrollLeft
        } else {
          const surplusX = maxLeft + this.contentTranslateX
          this.contentTranslateX = this.contentTranslateX - surplusX
          activeRect.style.left = `${getValuePx(activeRect.style.left) + (offsetScrollLeft - surplusX) * this.scale}px`
        }
      }
      // 内容区往右偏移
      if (offsetScrollLeft < 0) {
        if (this.allowMove('right', Math.abs(offsetScrollLeft))) {
          this.contentTranslateX = this.contentTranslateX - offsetScrollLeft
        } else {
          activeRect.style.left = `${getValuePx(activeRect.style.left) + (offsetScrollLeft - this.contentTranslateX) * this.scale}px`
          this.contentTranslateX = 0
        }
      }
      // 内容区向上偏移
      if (offsetScrollTop > 0) {
        if (this.allowMove('up', offsetScrollTop)) {
          this.contentTranslateY = this.contentTranslateY - offsetScrollTop
        } else {
          const surplusY = maxHeight + this.contentTranslateY
          this.contentTranslateY = this.contentTranslateY - surplusY
          activeRect.style.top = `${getValuePx(activeRect.style.top) + (offsetScrollTop - surplusY) * this.scale}px`
        }
      }
      // 内容区向下偏移
      if (offsetScrollTop < 0) {
        if (this.allowMove('down', Math.abs(offsetScrollTop))) {
          this.contentTranslateY = this.contentTranslateY - offsetScrollTop
        } else {
          activeRect.style.top = `${getValuePx(activeRect.style.top) + (offsetScrollTop - this.contentTranslateY) * this.scale}px`
          this.contentTranslateY = 0
        }
      }

      contentElement.style.transform = `scale(${this.scale}) translate(${this.contentTranslateX}px, ${this.contentTranslateY}px)`
      oldScrollLeft = realScrollLayer.scrollLeft
      oldScrollTop = realScrollLayer.scrollTop
    })
  }

  setDragMoveEvent() {
    const contentElement = this.contentElement
    let rootDragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.root.addEventListener('mousedown', e => {
      if (e.target !== this.root || e.button) return
      oldClientX = e.clientX
      oldClientY = e.clientY
      rootDragging = true
      this.scrollLock = true
    })
    this.root.addEventListener('mousemove', e => {
      if (!rootDragging || e.button) return

      const offsetX = e.clientX - oldClientX
      let allowMoveX = false
      if (offsetX > 0 && this.allowMove('right', offsetX)) allowMoveX = true
      if (offsetX < 0 && this.allowMove('left', Math.abs(offsetX))) allowMoveX = true
      if (allowMoveX) this.contentTranslateX = this.contentTranslateX + offsetX / this.scale

      const offsetY = e.clientY - oldClientY
      let allowMoveY = false
      if (offsetY > 0 && this.allowMove('down', offsetY)) allowMoveY = true
      if (offsetY < 0 && this.allowMove('up', Math.abs(offsetY))) allowMoveY = true
      if (allowMoveY) this.contentTranslateY = this.contentTranslateY + offsetY / this.scale

      contentElement.style.transform = `scale(${this.scale}) translate(${this.contentTranslateX}px, ${this.contentTranslateY}px)`
      oldClientX = e.clientX
      oldClientY = e.clientY
    })
    window.addEventListener('mouseup', e => {
      if (e.button) return
      rootDragging = false
      this.syncScroll()
      setTimeout(() => this.scrollLock = false, 100)
    })
  }

  setEvent() {
    this.scrollLock = false
    this.setRectEvent()
    this.setScrollEvent()
    this.setDragMoveEvent()
  }
}
