const initialContent = 
`html [
  head [ ]
  body [ ]
]
`

document.addEventListener('DOMContentLoaded', function () {
  const adomContent = document.querySelector('.adom')
  const htmlContent = document.querySelector('.html')

  function replaceContent () {
    let content

    try {
      content = adom.render(adomContent.value, {
        formatted: true
      })
    } catch (e) {
      content = e
    }

    if (content !== undefined) {
      htmlContent.value = content
    }
  }

  adomContent.value = initialContent

  adomContent.addEventListener('keydown', function (e) {
    if (e.keyCode === 9) {
      e.preventDefault()
      const s = this.selectionStart
      this.value = this.value.substring(0,this.selectionStart) + '  ' + this.value.substring(this.selectionEnd)
      this.selectionEnd = s + 2
    }
  })

  adomContent.addEventListener('keyup', replaceContent)
  replaceContent()
})