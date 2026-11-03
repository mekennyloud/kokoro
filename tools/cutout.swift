// Вырезает персонажей из картинки в PNG с прозрачным фоном — как «Скопировать объект» в Фото.
// Работает встроенным в macOS распознаванием, без интернета. Результат обрезается по контуру персонажа.
// Запуск: swift tools/cutout.swift <картинка> <результат.png>
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
guard args.count == 3, let src = NSImage(contentsOfFile: args[1]),
      let cg = src.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("Использование: swift tools/cutout.swift <картинка> <результат.png>"); exit(1)
}

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
try handler.perform([request])
guard let result = request.results?.first, !result.allInstances.isEmpty else {
    print("Персонажей не нашлось: \(args[1])"); exit(2)
}

// все найденные фигуры сразу, по контуру; лишнее поле вокруг обрезаем
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: true)
let ci = CIImage(cvPixelBuffer: buffer)
let ctx = CIContext()
guard let out = ctx.createCGImage(ci, from: ci.extent) else { exit(3) }
let rep = NSBitmapImageRep(cgImage: out)
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
print("\(args[2]): \(out.width)×\(out.height)")
