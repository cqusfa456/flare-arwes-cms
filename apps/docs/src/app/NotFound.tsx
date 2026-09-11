'use client'

import { Animator, Text } from '@arwes/react'

export default (): JSX.Element => (
  <Animator>
    <div className="flex m-auto p-4">
      <Text as="div" contentClassName="flex-1 flex flex-col gap-4">
        <h1 className="font-header text-size-3 text-primary-main-3">Not Found</h1>
        <p className="font-body text-size-7 text-primary-low-3">
          The location you are looking for was not found.
        </p>
      </Text>
    </div>
  </Animator>
)
