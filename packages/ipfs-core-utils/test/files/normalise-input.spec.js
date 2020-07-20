'use strict'

/* eslint-env mocha */
const { expect } = require('../utils/chai')
const normalise = require('../../src/files/normalise-input')
const { blobToIt } = require('../../src/files/normalise-input/utils')
const { supportsFileReader } = require('ipfs-utils/src/supports')
const { Buffer } = require('buffer')
const all = require('it-all')
const { Blob, ReadableStream } = require('ipfs-utils/src/globalthis')
const { isBrowser, isWebWorker } = require('ipfs-utils/src/env')

const STRING = () => 'hello world'
const BUFFER = () => Buffer.from(STRING())
const ARRAY = () => Array.from(BUFFER())
const TYPEDARRAY = () => Uint8Array.from(ARRAY())
let BLOB
let WINDOW_READABLE_STREAM

if (supportsFileReader) {
  BLOB = () => new Blob([
    STRING()
  ])

  WINDOW_READABLE_STREAM = () => new ReadableStream({
    start (controller) {
      controller.enqueue(BUFFER())
      controller.close()
    }
  })
}

async function verifyNormalisation (input) {
  expect(input.length).to.equal(1)
  expect(input[0].path).to.equal('')

  let content = input[0].content

  if (isBrowser || isWebWorker) {
    expect(content).to.be.an.instanceOf(Blob)
    content = blobToIt(input[0].content)
  }

  expect(content[Symbol.asyncIterator] || content[Symbol.iterator]).to.be.ok('Content should have been an iterable or an async iterable')
  await expect(all(content)).to.eventually.deep.equal([BUFFER()])
}

async function testContent (input) {
  const result = await all(normalise(input))

  await verifyNormalisation(result)
}

function iterableOf (thing) {
  return [thing]
}

function asyncIterableOf (thing) {
  return (async function * () { // eslint-disable-line require-await
    yield thing
  }())
}

describe('normalise-input', function () {
  function testInputType (content, name, isBytes) {
    it(name, async function () {
      await testContent(content())
    })

    if (isBytes) {
      it(`Iterable<${name}>`, async function () {
        await testContent(iterableOf(content()))
      })

      it(`AsyncIterable<${name}>`, async function () {
        await testContent(asyncIterableOf(content()))
      })
    }

    it(`{ path: '', content: ${name} }`, async function () {
      await testContent({ path: '', content: content() })
    })

    if (isBytes) {
      it(`{ path: '', content: Iterable<${name}> }`, async function () {
        await testContent({ path: '', content: iterableOf(content()) })
      })

      it(`{ path: '', content: AsyncIterable<${name}> }`, async function () {
        await testContent({ path: '', content: asyncIterableOf(content()) })
      })
    }

    it(`Iterable<{ path: '', content: ${name} }`, async function () {
      await testContent(iterableOf({ path: '', content: content() }))
    })

    it(`AsyncIterable<{ path: '', content: ${name} }`, async function () {
      await testContent(asyncIterableOf({ path: '', content: content() }))
    })

    if (isBytes) {
      it(`Iterable<{ path: '', content: Iterable<${name}> }>`, async function () {
        await testContent(iterableOf({ path: '', content: iterableOf(content()) }))
      })

      it(`Iterable<{ path: '', content: AsyncIterable<${name}> }>`, async function () {
        await testContent(iterableOf({ path: '', content: asyncIterableOf(content()) }))
      })

      it(`AsyncIterable<{ path: '', content: Iterable<${name}> }>`, async function () {
        await testContent(asyncIterableOf({ path: '', content: iterableOf(content()) }))
      })

      it(`AsyncIterable<{ path: '', content: AsyncIterable<${name}> }>`, async function () {
        await testContent(asyncIterableOf({ path: '', content: asyncIterableOf(content()) }))
      })
    }
  }

  describe('String', () => {
    testInputType(STRING, 'String', false)
  })

  describe('Buffer', () => {
    testInputType(BUFFER, 'Buffer', true)
  })

  describe('Blob', () => {
    if (!supportsFileReader) {
      return
    }

    testInputType(BLOB, 'Blob', false)
  })

  describe('window.ReadableStream', () => {
    if (!supportsFileReader) {
      return
    }

    testInputType(WINDOW_READABLE_STREAM, 'window.ReadableStream', false)
  })

  describe('Iterable<Number>', () => {
    testInputType(ARRAY, 'Iterable<Number>', false)
  })

  describe('TypedArray', () => {
    testInputType(TYPEDARRAY, 'TypedArray', true)
  })
})
