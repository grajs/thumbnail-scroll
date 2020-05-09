import './index.scss'

const getValueOfPx = value => +value.replace(/px$/, '')

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
      // 宽度或高度铺满
      fullOrientation,
      width,
      height
    } = option

    // 确定滚动层
    if (scrollLayer) option.scrollXLayer = option.scrollYLayer = scrollLayer
    if (!scrollXLayer || scrollXLayer === window) option.scrollXLayer = document.documentElement
    if (!scrollYLayer || scrollYLayer === window) option.scrollYLayer = document.documentElement

    // 自动设置比例
    if (!scale) {
      const {width: targetWidth, height: targetHeight} = target.getBoundingClientRect()
      if (!/^width|height$/.test(fullOrientation)) {
        fullOrientation = targetWidth > targetHeight ? 'height' : 'width'
      }
      option.scale = fullOrientation === 'width' ? width / targetWidth : height / targetHeight
    }
    this.option = option
    this.target = option.target
  }

  init() {
    this.createElement()
    this.createRect()
    this.setEvent()
  }

  createElement() {
    const { mode, skeletonClassName, width, height, parentElement } = this.option
    const root = document.createElement('div')
    root.classList.add('thumbnail-scroll')
    root.style.width = `${width}px`
    root.style.height = `${height}px`
    parentElement && parentElement.appendChild(root)
    this.root = root

    if (mode === 'skeleton') {
      if (typeof skeletonClassName !== 'string') {
        throw '"option.skeletonClassName" should be a String'
        return
      }
      this.createSkeleton()
    }

    this.contentPositionData = this.content.getBoundingClientRect()
  }

  createRect() {
    const { scrollXLayer, scrollYLayer, scale } = this.option
    const rect = document.createElement('div')
    rect.classList.add('thumbnail-scroll-rect')
    const { style } = rect
    style.width = `${scrollXLayer.clientWidth * scale}px`
    style.height = `${scrollYLayer.clientHeight * scale}px`
    style.left = `${scrollXLayer.scrollLeft * scale}px`
    style.top = `${scrollYLayer.scrollTop * scale}px`
    this.rect = rect
    this.root.appendChild(rect)
  }

  syncRect() {
    const { size, scale } = this.option
    const realScrollLayer = this.option.scrollXLayer
    const rectWidth = realScrollLayer.clientWidth * scale
    const rectHeight = realScrollLayer.clientHeight * scale
    const rectLeft = realScrollLayer.scrollLeft * scale
    const rectTop = realScrollLayer.scrollTop * scale
    const { style } = this.rect
    style.width = `${rectWidth}px`
    style.height = `${rectHeight}px`
    style.left = `${rectLeft}px`
    style.top = `${rectTop}px`
    // 判断缩略图能否上下移动
    if (this.fullDirectionX && rectTop + rectHeight > size) {
      this.translateY = -((rectTop + rectHeight - size) / scale)
      style.top = `${size - rectHeight}px`
    }
    // 判断缩略图能否左右移动
    if (!this.fullDirectionX && rectLeft + rectWidth > size) {
      this.translateX = -((rectLeft + rectWidth - size) / scale)
      style.left = `${size - rectWidth}px`
    }
    this.contentElement.style.transform = `scale(${scale}) translate(${this.translateX}px, ${this.translateY}px)`
  }

  createSkeleton() {
    const { scale } = this.option
    const { width: targetWidth, height: targetHeight } = this.target.getBoundingClientRect()
    const content = document.createElement('div')
    const { style } = content
    style.width = `${targetWidth * scale}px`
    style.height = `${targetHeight * scale}px`
    content.classList.add('thumbnail-scroll-content', 'is-skeleton')
    this.root.appendChild(content)
    this.content = content
    this.createSkeletonItem()
  }

  createSkeletonItem() {
    const { target, skeletonClassName, scale } = this.option
    const { left: targetLeft, top: targetTop } = target.getBoundingClientRect()
    target.querySelectorAll(`.${skeletonClassName}`).forEach(item => {
      const { width: itemWidth, height: itemHeight, x: itemLeft, y: itemTop } = item.getBoundingClientRect()
      const skeletonItem = document.createElement('div')
      skeletonItem.classList.add('thumbnail-skeleton-item')
      const skeletonItemStyle = skeletonItem.style
      skeletonItemStyle.width = `${itemWidth * scale}px`
      skeletonItemStyle.height = `${itemHeight * scale}px`
      skeletonItemStyle.left = `${(itemLeft - targetLeft) * scale}px`
      skeletonItemStyle.top = `${(itemTop - targetTop) * scale}px`
      this.content.appendChild(skeletonItem)
    })
  }

  stopBoundaryScroll() {
    if (!this.boundaryScrollInterval) return
    clearInterval(this.boundaryScrollInterval)
    this.boundaryScrollInterval = null
  }

  setBoundaryData() {
    const { size } = this.option
    const rect = this.rect
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    const { width: rectWidth, height: rectHeight } = rect.getBoundingClientRect()
    const rectStyle = getComputedStyle(rect)
    const rectLeft = getValueOfPx(rectStyle.left)
    const rectTop = getValueOfPx(rectStyle.top)
    this.boundaryData = {
      left: rectLeft === 0 && this.translateX < 0 && this.rectMoveData.left,
      right: Math.abs(rectLeft - (size - rectWidth)) < 1 && this.translateX * scale > size - contentWidth && this.rectMoveData.right,
      top: rectTop === 0 && this.translateY < 0 && this.rectMoveData.top,
      bottom: Math.abs(rectTop - (size - rectHeight)) < 1 && this.translateY * scale > size - contentHeight && this.rectMoveData.bottom
    }
  }

  syncScroll() {
    const { scale, scrollXLayer, scrollYLayer } = this.option
    const { left: rectLeft, top: rectTop } = this.rect.style
    scrollXLayer.scrollLeft = -this.translateX + getValueOfPx(rectLeft) / scale
    scrollYLayer.scrollTop = -this.translateY + getValueOfPx(rectTop) / scale
  }

  // 偏移一定距离后是否会超出边界
  allowMove(direct, offsetValue) {
    const { width, height, scale } = this.option
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    // 往左偏移
    if (direct === 'left') {
      const maxLeft = (contentWidth - size) / scale
      return -this.translateX + offsetValue < maxLeft
    }
    // 往右偏移
    if (direct === 'right') {
      return -this.translateX > offsetValue
    }
    // 往上偏移
    if (direct === 'up') {
      const maxHeight = (contentHeight - size) / scale
      return -this.translateY + offsetValue < maxHeight
    }
    // 往下偏移
    if (direct === 'down') {
      return -this.translateY > offsetValue
    }
  }

  boundaryScroll() {
    const { size } = this.option
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    const content = this.content
    const touchBoundary = () => this.boundaryData.left || this.boundaryData.right || this.boundaryData.top || this.boundaryData.bottom
    if (touchBoundary) {
      if (this.boundaryScrollInterval) return
      this.boundaryScrollInterval = setInterval(() => {
        if (this.boundaryData.left) {
          this.translateX = this.translateX + 3 / scale
          if (this.translateX > 0) {
            this.translateX = 0
            this.boundaryData.left = false
          }
        }
        if (this.boundaryData.top) {
          this.translateY = this.translateY + 3 / scale
          if (this.translateY > 0) {
            this.translateY = 0
            this.boundaryData.top = false
          }
        }
        if (this.boundaryData.right) {
          this.translateX = this.translateX - 3 / scale
          const maxLeft = -(contentWidth - size) / scale
          if (this.translateX < maxLeft) {
            this.translateX = Math.round(maxLeft)
            this.boundaryData.right = false
          }
        }
        if (this.boundaryData.bottom) {
          this.translateY = this.translateY - 3 / scale
          const maxTop = -(contentHeight - size) / scale
          if (this.translateY < maxTop) {
            this.translateY = Math.round(maxTop)
            this.boundaryData.bottom = false
          }
        }
        !touchBoundary() && this.stopBoundaryScroll()
        contentElement.style.transform = `scale(${scale}) translate(${this.translateX}px, ${this.translateY}px)`
      }, 20)
    } else {
      this.stopBoundaryScroll()
    }
  }

  move(x, y) {
    const rect = this.rect
    const { style: rectStyle } = rect
    const { left: rectLeft, right: rectRight, top: rectTop, bottom: rectBottom } = rect.getBoundingClientRect()
    const { left: contentLeft, right: contentRight, top: contentTop, bottom: contentBottom } = this.contentPositionData
    if (x) {
      let offsetX = x
      if (x > 0) {
        const surplusRight = contentRight - rectRight
        // 右侧距离不够的情况尝试移动内容区
        if (surplusRight < x) {
          offsetX = surplusRight
        }
      }
      if (x < 0) {
        const surplusLeft = rectLeft - contentLeft
        // 左侧距离不够的情况尝试移动内容区
        if (surplusLeft < Math.abs(x)) {
          offsetX = surplusLeft
        }
      }
      if (x) rectStyle.left = `${getValueOfPx(rectStyle.left) + offsetX}px`
    }
    if (y) {
      let offsetY = y
      if (y > 0) {
        const surplusBottom = contentBottom - rectBottom
        console.log(this.contentPositionData.bottom, this.content.getBoundingClientRect(), rectBottom)
        // 下方距离不够的情况尝试移动内容区
        if (surplusBottom < y) {
          offsetY = surplusBottom
        }
      }
      if (y < 0) {
        const surplusTop = rectTop - contentTop
        // 上方距离不够的情况尝试移动内容区
        if (surplusTop < Math.abs(y)) {
          offsetY = surplusTop
        }
      }
      if (y) rectStyle.top = `${getValueOfPx(rectStyle.top) + offsetY}px`
    }
  }

  // 拖动矩形
  setRectDragEvent() {
    const rect = this.rect
    let dragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.rectMoveData = {
      left: false,
      right: false,
      top: false,
      bottom: false
    }
    rect.addEventListener('mousedown', ({ button, clientX, clientY }) => {
      if (button !== 0) return
      oldClientX = clientX
      oldClientY = clientY
      dragging = true
    })
    this.root.addEventListener('mousemove', ({ clientX, clientY }) => {
      if (!dragging) return
      this.move(clientX - oldClientX, clientY - oldClientY)
      oldClientX = clientX
      oldClientY = clientY
    })
    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false
        // 不触发滚动事件的回调
        this.scrollEventLock = true
        this.syncScroll()
      }
    })
  }

  setScrollEvent() {
    const { scrollLayer, size, scale } = this.option
    const realScrollLayer = this.realScrollLayer
    const contentElement = this.contentElement
    const rect = this.rect
    const { width: contentWidth, height: contentHeight } = contentElement.getBoundingClientRect()
    let oldScrollLeft = realScrollLayer.scrollLeft
    let oldScrollTop = realScrollLayer.scrollTop
    scrollLayer.addEventListener('scroll', () => {
      if (this.scrollEventLock) {
        oldScrollLeft = realScrollLayer.scrollLeft
        oldScrollTop = realScrollLayer.scrollTop
        this.scrollEventLock = false
        return
      }
      const maxLeft = (contentWidth - size) / scale
      const maxHeight = (contentHeight - size) / scale
      const offsetScrollLeft = realScrollLayer.scrollLeft - oldScrollLeft
      const offsetScrollTop = realScrollLayer.scrollTop - oldScrollTop

      // 往右滚动
      if (offsetScrollLeft > 0) {
        if (this.allowMove('left', offsetScrollLeft)) {
          this.translateX = this.translateX - offsetScrollLeft
        } else {
          const surplusX = maxLeft + this.translateX
          this.translateX = this.translateX - surplusX
          rect.style.left = `${getValueOfPx(rect.style.left) + (offsetScrollLeft - surplusX) * scale}px`
        }
      }
      // 内容区往右偏移
      if (offsetScrollLeft < 0) {
        if (this.allowMove('right', Math.abs(offsetScrollLeft))) {
          this.translateX = this.translateX - offsetScrollLeft
        } else {
          rect.style.left = `${getValueOfPx(rect.style.left) + (offsetScrollLeft - this.translateX) * scale}px`
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
          rect.style.top = `${getValueOfPx(rect.style.top) + (offsetScrollTop - surplusY) * scale}px`
        }
      }
      // 内容区向下偏移
      if (offsetScrollTop < 0) {
        if (this.allowMove('down', Math.abs(offsetScrollTop))) {
          this.translateY = this.translateY - offsetScrollTop
        } else {
          rect.style.top = `${getValueOfPx(rect.style.top) + (offsetScrollTop - this.translateY) * scale}px`
          this.translateY = 0
        }
      }

      contentElement.style.transform = `scale(${scale}) translate(${this.translateX}px, ${this.translateY}px)`
      oldScrollLeft = realScrollLayer.scrollLeft
      oldScrollTop = realScrollLayer.scrollTop
    })
  }

  // 拖拽非活动块
  setDragMoveEvent() {
    const { scale } = this.option
    const contentElement = this.contentElement
    let rootDragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.root.addEventListener('mousedown', e => {
      if (e.target !== this.root || e.button) return
      oldClientX = e.clientX
      oldClientY = e.clientY
      rootDragging = true
    })
    this.root.addEventListener('mousemove', e => {
      if (!rootDragging || e.button) return

      const offsetX = e.clientX - oldClientX
      let allowMoveX = false
      if (offsetX > 0 && this.allowMove('right', offsetX)) allowMoveX = true
      if (offsetX < 0 && this.allowMove('left', Math.abs(offsetX))) allowMoveX = true
      if (allowMoveX) this.translateX = this.translateX + offsetX / scale

      const offsetY = e.clientY - oldClientY
      let allowMoveY = false
      if (offsetY > 0 && this.allowMove('down', offsetY)) allowMoveY = true
      if (offsetY < 0 && this.allowMove('up', Math.abs(offsetY))) allowMoveY = true
      if (allowMoveY) this.translateY = this.translateY + offsetY / scale

      contentElement.style.transform = `scale(${scale}) translate(${this.translateX}px, ${this.translateY}px)`
      oldClientX = e.clientX
      oldClientY = e.clientY
    })
    window.addEventListener('mouseup', e => {
      if (e.button) return
      if (rootDragging) {
        rootDragging = false
        this.scrollEventLock = true
        this.syncScroll()
      }
    })
  }

  setEvent() {
    this.boundaryScrollInterval = null
    this.translateX = 0
    this.translateY = 0
    this.scrollEventLock = false
    this.setRectDragEvent()
    // this.setDragMoveEvent()
    // this.setScrollEvent()
  }
}
