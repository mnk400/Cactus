import React from 'react'

function ErrorMessage({ message }) {
  return (
    <div className="h-full w-full flex justify-center items-center">
      <div className="text-red-500 p-2.5 text-center bg-red-500 bg-opacity-10 rounded mt-2.5 max-w-md">
        {message}
      </div>
    </div>
  )
}

export default ErrorMessage
