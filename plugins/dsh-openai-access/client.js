window.__ModuleLoader__.load({
  id: '@local/dsh-openai-access',
  factory(require) {
    const { useMemo } = require('react')
    const slot = 'conversation.chat.turnTail'
    const gallery = 'conversation.images.content'

    function turnImages(snapshot, turn) {
      const images = new Map()
      function readTool(block) {
        if (!block) return
        if (block.call?.name === 'generate_openai_image' && !block.isError) {
          for (const part of block.content ?? []) {
            const ref = part?.type === 'image' ? part.attachment : undefined
            if (ref?.attachmentId) images.set(ref.attachmentId, { attachment: ref })
          }
        }
        for (const child of block.subCalls ?? []) readTool(child)
      }
      for (const key of snapshot.locations.getTurn(turn)) {
        const node = snapshot.nodes.get(key)
        if (node?.kind === 'tool-call') readTool(node.data.root)
      }
      return JSON.stringify([...images.values()])
    }

    function OpenAIImageTail({ turn, useChat, renderFactorySlot, loadImage }) {
      // Tool blocks remain in the turn index when the process rows are folded.
      const serialized = useChat(snapshot => turnImages(snapshot, turn.turn))
      const images = useMemo(() => JSON.parse(serialized), [serialized])
      if (!images.length) return null
      return renderFactorySlot(gallery, { images, loadImage, align: 'start' })
    }

    return {
      inject: ['slots', 'uiConversation'],
      apply(ctx) {
        ctx.slots.inject(slot, () => ctx.slots.register({
          name: slot,
          id: 'openai-generated-images',
          inject: sessionId => ({
            loadImage: attachment => ctx.uiConversation.imageUrl(sessionId, attachment),
          }),
        }, OpenAIImageTail))
      },
    }
  },
})
