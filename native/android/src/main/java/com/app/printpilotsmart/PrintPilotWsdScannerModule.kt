package com.app.printpilotsmart

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.wifi.WifiManager
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.w3c.dom.Document
import org.w3c.dom.Node
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.URL
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import javax.xml.parsers.DocumentBuilderFactory

private class WsdTerminalScanFailure(message: String) : IllegalStateException(message)

/** Android WSD/WS-Scan client. Discovery, scan data, and file processing stay on the device/LAN. */
class PrintPilotWsdScannerModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val scanElementNamespace = "http://schemas.microsoft.com/windows/2006/08/wdp/scan"
  private val scanActionBase = "http://schemas.microsoft.com/windows/2006/08/wdp/scan"
  private val soapNamespace = "http://www.w3.org/2003/05/soap-envelope"
  private val addressNamespace = "http://schemas.xmlsoap.org/ws/2004/08/addressing"

  override fun getName(): String = "PrintPilotWsdScanner"

  @ReactMethod
  fun discover(promise: Promise) {
    worker.execute {
      try {
        promise.resolve(discoverDevices())
      } catch (error: Throwable) {
        promise.reject("WSD_DISCOVERY_FAILED", error.message ?: "Local WSD discovery failed", error)
      }
    }
  }

  @ReactMethod
  fun scan(
    serviceUrl: String,
    inputSource: String,
    dpi: Int,
    color: String,
    duplex: Boolean,
    outputFormat: String,
    requestId: String,
    promise: Promise,
  ) {
    worker.execute {
      var jobId: String? = null
      val createdFiles = mutableListOf<File>()
      try {
        val endpoint = validateScannerUrl(serviceUrl)
        val resolution = dpi.coerceIn(100, 600)
        val isFeeder = inputSource.equals("ADF", true) || inputSource.equals("Feeder", true)
        val source = if (!isFeeder) "Platen" else if (duplex) "ADFDuplex" else "ADF"
        val processing = if (color.equals("bw", true) || color.equals("black-and-white", true)) "Grayscale8" else "RGB24"
        val created = createScanJobWithRetry(endpoint, createJobRequest(source, resolution, processing, duplex))
        jobId = findText(created, "JobId") ?: run {
          val fault = scannerFault(created)
          if (fault != null) throw WsdTerminalScanFailure(fault)
          throw IllegalStateException("The scanner did not return a WSD JobId")
        }
        val token = findText(created, "JobToken") ?: run {
          val fault = scannerFault(created)
          if (fault != null) throw WsdTerminalScanFailure(fault)
          throw IllegalStateException("The scanner did not return a WSD JobToken")
        }
        emitScanStatus(requestId, "in-progress")

        val pngOutput = outputFormat.equals("png", true)
        val outDir = File(context.filesDir, "PrintPilotScans").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US).format(Date())
        val pages = retrieveAllDocuments(endpoint, jobId, token, pngOutput, outDir, stamp, createdFiles)
        emitScanStatus(requestId, "completed")
        promise.resolve(Arguments.createMap().apply {
          putArray("pages", pages)
          putString("inputSource", source)
          putString("dpi", resolution.toString())
          putString("jobId", jobId)
          putString("protocol", "WSD Scan")
      })
      } catch (error: Throwable) {
        emitScanStatus(requestId, if (error is WsdTerminalScanFailure) "failed" else "awaiting-confirmation", error.message)
        createdFiles.forEach { try { it.delete() } catch (_: Throwable) { } }
        jobId?.let { activeJobId ->
          try { soap(validateScannerUrl(serviceUrl), "CancelJob", cancelJobRequest(activeJobId)) } catch (_: Throwable) { }
        }
        promise.reject("WSD_SCAN_FAILED", error.message ?: "The local WSD scan did not complete", error)
      }
    }
  }

  private fun emitScanStatus(requestId: String, state: String, message: String? = null) {
    try {
      val payload = Arguments.createMap().apply {
        putString("requestId", requestId)
        putString("state", state)
        if (!message.isNullOrBlank()) putString("message", message)
      }
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("PrintPilotWsdScanStatus", payload)
    } catch (_: Throwable) {
      // Status events are best-effort; the promise still carries the terminal result.
    }
  }

  private fun discoverDevices(): WritableArray {
    val results = Arguments.createArray()
    val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    val lock = wifi?.createMulticastLock("printpilot-wsd-discovery")?.apply {
      setReferenceCounted(false)
      acquire()
    }
    try {
      DatagramSocket(null).use { socket ->
        socket.reuseAddress = true
        socket.soTimeout = 300
        socket.bind(InetSocketAddress(0))
        val probe = discoveryProbe().toByteArray(StandardCharsets.UTF_8)
        socket.send(DatagramPacket(probe, probe.size, InetAddress.getByName("239.255.255.250"), 3702))
        val deadline = System.currentTimeMillis() + 4000
        val seen = mutableSetOf<String>()
        while (System.currentTimeMillis() < deadline) {
          try {
            val buffer = ByteArray(65507)
            val packet = DatagramPacket(buffer, buffer.size)
            socket.receive(packet)
            val xml = String(packet.data, packet.offset, packet.length, StandardCharsets.UTF_8)
            val doc = parseXml(xml.toByteArray(StandardCharsets.UTF_8))
            findElements(doc, "ProbeMatch").forEach matchLoop@ { match ->
              val serviceTypes = parseServiceTypes(match)
              // A multicast response can contain an unrelated or malformed ProbeMatch.
              // Require its own Types QName to resolve to the WSD Scan namespace.
              if (serviceTypes.none { it.first == scanElementNamespace && it.second == "ScanDeviceType" }) return@matchLoop
              val addresses = findTexts(match, "XAddrs")
                .flatMap { it.split(Regex("\\s+")) }
                .sortedBy { if (it.startsWith("http://", true)) 0 else 1 }
              if (addresses.isNotEmpty()) {
                val manufacturer = findText(match, "Manufacturer")
                val model = findText(match, "ModelName") ?: findText(match, "Model")
                val friendlyName = findText(match, "FriendlyName") ?: findText(match, "DeviceName")
                addresses.forEach addressLoop@ { raw ->
                  val uri = try { normalizeWsdEndpoint(raw, packet.address).let(::validateScannerUrl) } catch (_: Throwable) { return@addressLoop }
                  val host = URL(uri).host.removePrefix("[").removeSuffix("]")
                  if (seen.add(host.lowercase(Locale.US))) {
                    val name = friendlyName?.takeIf { it.isNotBlank() }
                      ?: listOfNotNull(manufacturer, model).joinToString(" ").takeIf { it.isNotBlank() }
                    results.pushMap(Arguments.createMap().apply {
                      putString("serviceUrl", uri)
                      if (!name.isNullOrBlank()) putString("name", name)
                      if (!model.isNullOrBlank()) putString("model", model)
                      putString("address", host)
                      putArray("serviceTypes", Arguments.createArray().apply {
                        serviceTypes.forEach { (namespace, localName) ->
                          pushMap(Arguments.createMap().apply {
                            putString("namespace", namespace)
                            putString("localName", localName)
                          })
                        }
                      })
                    })
                  }
                }
              }
            }
          } catch (_: java.net.SocketTimeoutException) {
            // Keep the bounded multicast discovery window open.
          }
        }
      }
    } finally {
      try { if (lock?.isHeld == true) lock.release() } catch (_: Throwable) { }
    }
    return results
  }

  private fun discoveryProbe(): String = """
    <?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:wscn="$scanElementNamespace">
      <s:Header>
        <a:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
        <a:ReplyTo><a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address></a:ReplyTo>
        <a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
        <a:MessageID>uuid:${UUID.randomUUID()}</a:MessageID>
      </s:Header>
      <s:Body><d:Probe><d:Types>wscn:ScanDeviceType</d:Types></d:Probe></s:Body>
    </s:Envelope>
  """.trimIndent()

  private fun createJobRequest(source: String, dpi: Int, colorProcessing: String, duplex: Boolean): String {
    val mediaBack = if (duplex && source == "ADFDuplex") """
      <wscn:MediaBack><wscn:ColorProcessing>$colorProcessing</wscn:ColorProcessing><wscn:Resolution><wscn:Width>$dpi</wscn:Width><wscn:Height>$dpi</wscn:Height></wscn:Resolution></wscn:MediaBack>
    """.trimIndent() else ""
    return """
      <wscn:CreateScanJobRequest>
        <wscn:ScanTicket>
          <wscn:JobDescription><wscn:JobName>PrintPilot local scan</wscn:JobName><wscn:JobOriginatingUserName>PrintPilot</wscn:JobOriginatingUserName></wscn:JobDescription>
          <wscn:DocumentParameters>
            <wscn:Format>jfif</wscn:Format><wscn:ImagesToTransfer>0</wscn:ImagesToTransfer>
            <wscn:InputSource>$source</wscn:InputSource><wscn:ContentType>Auto</wscn:ContentType>
            <wscn:InputSize><wscn:DocumentSizeAutoDetect>true</wscn:DocumentSizeAutoDetect></wscn:InputSize>
            <wscn:MediaSides>
              <wscn:MediaFront><wscn:ColorProcessing>$colorProcessing</wscn:ColorProcessing><wscn:Resolution><wscn:Width>$dpi</wscn:Width><wscn:Height>$dpi</wscn:Height></wscn:Resolution></wscn:MediaFront>
              $mediaBack
            </wscn:MediaSides>
          </wscn:DocumentParameters>
        </wscn:ScanTicket>
      </wscn:CreateScanJobRequest>
    """.trimIndent()
  }

  private fun getJobRequest(jobId: String): String = """
    <wscn:GetJobElements><wscn:JobId>${xmlEscape(jobId)}</wscn:JobId>
      <wscn:RequestedElements><wscn:Name>JobStatus</wscn:Name><wscn:Name>Documents</wscn:Name></wscn:RequestedElements>
    </wscn:GetJobElements>
  """.trimIndent()

  private fun retrieveImageRequest(jobId: String, jobToken: String, documentName: String): String = """
    <wscn:RetrieveImageRequest><wscn:JobId>${xmlEscape(jobId)}</wscn:JobId><wscn:JobToken>${xmlEscape(jobToken)}</wscn:JobToken>
      <wscn:DocumentDescription><wscn:DocumentName>${xmlEscape(documentName)}</wscn:DocumentName></wscn:DocumentDescription>
    </wscn:RetrieveImageRequest>
  """.trimIndent()

  private fun cancelJobRequest(jobId: String): String = """
    <wscn:CancelJobRequest><wscn:JobId>${xmlEscape(jobId)}</wscn:JobId></wscn:CancelJobRequest>
  """.trimIndent()

  private data class HttpResult(val bytes: ByteArray, val contentType: String)

  /**
   * Kyocera returns SOAP fault ServerErrorNotAcceptingJobs ("temporarily blocked") while it is busy,
   * e.g. right after a print job. The scan did not start, so waiting and retrying is safe.
   */
  private fun createScanJobWithRetry(endpoint: String, body: String): Document {
    var attempt = 0
    while (true) {
      try {
        return soap(endpoint, "CreateScanJob", body)
      } catch (error: IllegalStateException) {
        val text = error.message.orEmpty()
        val busy = text.contains("NotAcceptingJobs", true) || text.contains("temporarily blocked", true)
        if (!busy) throw error
        attempt += 1
        if (attempt >= 5) {
          throw WsdTerminalScanFailure(
            "The scanner is busy and refused the job (ServerErrorNotAcceptingJobs) even after several retries. " +
              "Wait until the printer finishes any print job, make sure its screen is idle (no menu or error), then try again.",
          )
        }
        Thread.sleep(4000)
      }
    }
  }

  private fun soap(url: String, operation: String, body: String): Document = parseXml(soapBytes(url, operation, body).bytes)

  private fun soapBytes(url: String, operation: String, body: String): HttpResult {
    val endpoint = validateScannerUrl(url)
    val action = "$scanActionBase/$operation"
    val envelope = """
      <?xml version="1.0" encoding="UTF-8"?>
      <s:Envelope xmlns:s="$soapNamespace" xmlns:a="$addressNamespace" xmlns:wscn="$scanElementNamespace">
        <s:Header><a:To>${xmlEscape(endpoint)}</a:To><a:Action>$action</a:Action><a:MessageID>uuid:${UUID.randomUUID()}</a:MessageID></s:Header>
        <s:Body>$body</s:Body>
      </s:Envelope>
    """.trimIndent().toByteArray(StandardCharsets.UTF_8)
    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      instanceFollowRedirects = false
      connectTimeout = 6000
      readTimeout = 30000
      doOutput = true
      setRequestProperty("Content-Type", "application/soap+xml; charset=utf-8; action=\"$action\"")
      setRequestProperty("Accept", "multipart/related, application/soap+xml, application/octet-stream, image/jpeg, image/png")
      setRequestProperty("User-Agent", "PrintPilot-Local-WSD/1.0")
    }
    try {
      connection.outputStream.use { it.write(envelope) }
      val status = connection.responseCode
      val stream = if (status in 200..299) connection.inputStream else connection.errorStream
      val bytes = stream?.use { it.readBytes() } ?: ByteArray(0)
      if (status !in 200..299) {
        val fault = try { scannerFault(parseXml(bytes)) } catch (_: Throwable) { null }
        val excerpt = String(bytes, StandardCharsets.UTF_8).replace(Regex("\\s+"), " ").trim().take(240)
        val detail = fault ?: excerpt.takeIf { it.isNotBlank() }
        throw IllegalStateException("WSD $operation HTTP $status${detail?.let { ": $it" } ?: ""}")
      }
      return HttpResult(bytes, connection.contentType ?: "")
    } finally {
      connection.disconnect()
    }
  }

  private fun retrieveAllDocuments(
    url: String,
    jobId: String,
    token: String,
    pngOutput: Boolean,
    outDir: File,
    stamp: String,
    createdFiles: MutableList<File>,
  ): WritableArray {
    // ADF documents can become available progressively; keep polling until the job is terminal.
    // There is deliberately no page-count truncation. The 15-minute bound fails the whole job
    // instead of returning a partial scan as if it were complete.
    val deadline = System.currentTimeMillis() + 15 * 60 * 1000
    val discoveredNames = linkedSetOf<String>()
    val retrievedNames = mutableSetOf<String>()
    val pages = Arguments.createArray()
    var lastError: Throwable? = null
    while (System.currentTimeMillis() < deadline) {
      val result = try {
        soap(url, "GetJobElements", getJobRequest(jobId)).also { lastError = null }
      } catch (error: Throwable) {
        lastError = error
        Thread.sleep(700)
        continue
      }
      discoveredNames.addAll(findTexts(result, "DocumentName").filter { it.isNotBlank() })

      for (documentName in discoveredNames) {
        if (documentName in retrievedNames) continue
        try {
          val response = soapBytes(url, "RetrieveImage", retrieveImageRequest(jobId, token, documentName))
          val jpeg = extractJpeg(response.bytes)
          if (jpeg.isEmpty()) {
            val contentType = response.contentType.ifBlank { "unknown content type" }
            throw IllegalStateException("WSD returned no JPEG image for $documentName ($contentType)")
          }
          val image = if (pngOutput) jpegToPng(jpeg) else jpeg
          val extension = if (pngOutput) "png" else "jpg"
          val mimeType = if (pngOutput) "image/png" else "image/jpeg"
          val index = retrievedNames.size + 1
          val file = File(outDir, "Kyocera-WSD-$stamp-${index.toString().padStart(2, '0')}.$extension")
          file.writeBytes(image)
          createdFiles.add(file)
          pages.pushMap(Arguments.createMap().apply {
            putString("uri", "file://${file.absolutePath}")
            putString("name", file.name)
            putString("mimeType", mimeType)
            putDouble("size", file.length().toDouble())
          })
          retrievedNames.add(documentName)
        } catch (error: Throwable) {
          val detail = error.message.orEmpty().lowercase(Locale.US)
          if (detail.contains("clienterrornoimagesavailable") || detail.contains("no images available")) {
            // The document may be listed before its image is ready; retry it on the next poll.
            lastError = error
          } else {
            throw error
          }
        }
      }

      val state = findText(result, "JobState")?.lowercase(Locale.US)?.filter { it.isLetterOrDigit() }.orEmpty()
      when {
        state.contains("completedwitherrors") -> throw WsdTerminalScanFailure(
          "The WSD scanner reported CompletedWithErrors. Scan data may be missing; the partial result was discarded.",
        )
        state.contains("aborted") || state.contains("canceled") || state.contains("cancelled") -> throw WsdTerminalScanFailure(
          "The WSD scan job ended in state ${findText(result, "JobState")}; no partial scan was returned.",
        )
        state.contains("completed") -> {
          if (discoveredNames.isEmpty()) throw WsdTerminalScanFailure("The WSD job completed without an image document")
          val missing = discoveredNames - retrievedNames
          if (missing.isNotEmpty()) throw WsdTerminalScanFailure(
            "The WSD job completed before all listed image data could be retrieved; the partial scan was discarded.",
          )
          if (retrievedNames.isEmpty()) throw WsdTerminalScanFailure("The WSD job completed without a retrievable image document")
          val expectedImages = findText(result, "ScansCompleted")?.toLongOrNull()
          if (expectedImages != null && expectedImages != retrievedNames.size.toLong()) throw WsdTerminalScanFailure(
            "The WSD job's reported output could not be fully retrieved; the partial scan was discarded.",
          )
          return pages
        }
      }
      Thread.sleep(700)
    }
    throw IllegalStateException(
      lastError?.message ?: "Timed out after 15 minutes waiting for WSD scan completion; no partial scan was returned.",
    )
  }

  private fun extractJpeg(bytes: ByteArray): ByteArray {
    val direct = jpegSlice(bytes)
    if (direct.isNotEmpty()) return direct
    val encoded = try {
      val xml = parseXml(bytes)
      findText(xml, "Image") ?: findText(xml, "ImageData") ?: return ByteArray(0)
    } catch (_: Throwable) { return ByteArray(0) }
    val decoded = try { Base64.decode(encoded, Base64.DEFAULT) } catch (_: Throwable) { return ByteArray(0) }
    return jpegSlice(decoded)
  }

  private fun jpegSlice(bytes: ByteArray): ByteArray {
    val start = (0 until (bytes.size - 1).coerceAtLeast(0)).firstOrNull { bytes[it] == 0xFF.toByte() && bytes[it + 1] == 0xD8.toByte() } ?: return ByteArray(0)
    val end = (bytes.size - 2 downTo start).firstOrNull { bytes[it] == 0xFF.toByte() && bytes[it + 1] == 0xD9.toByte() } ?: return ByteArray(0)
    return bytes.copyOfRange(start, end + 2)
  }

  private fun jpegToPng(jpeg: ByteArray): ByteArray {
    val bitmap = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: throw IllegalStateException("Could not decode the WSD JPEG for PNG output")
    return try {
      ByteArrayOutputStream().use { output ->
        if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw IllegalStateException("Could not encode local PNG output")
        output.toByteArray()
      }
    } finally {
      bitmap.recycle()
    }
  }

  private fun normalizeWsdEndpoint(raw: String, responder: InetAddress): String {
    val advertised = URL(raw.trim())
    val host = advertised.host.removePrefix("[").removeSuffix("]")
    if (host.contains(':') || isIpv4Literal(host)) return advertised.toExternalForm()
    val responderIp = responder.hostAddress?.substringBefore('%') ?: throw IllegalArgumentException("WSD response has no source address")
    val safeHost = if (responderIp.contains(':')) "[$responderIp]" else responderIp
    val port = if (advertised.port >= 0) ":${advertised.port}" else ""
    return "${advertised.protocol}://$safeHost$port${advertised.file}"
  }

  private fun isIpv4Literal(host: String): Boolean {
    val parts = host.split('.')
    return parts.size == 4 && parts.all { part -> part.toIntOrNull()?.let { it in 0..255 } == true }
  }

  private fun validateScannerUrl(raw: String): String {
    val url = URL(raw.trim())
    if (url.protocol != "http" && url.protocol != "https") throw IllegalArgumentException("Only local HTTP/HTTPS WSD scanner endpoints are supported")
    if (url.userInfo != null) throw IllegalArgumentException("Credentials in WSD URLs are not supported")
    val host = url.host.removePrefix("[").removeSuffix("]")
    val ipv4Parts = host.split('.')
    val isV4 = isIpv4Literal(host)
    val isIpv6Literal = host.contains(':')
    if (!isV4 && !isIpv6Literal) throw IllegalArgumentException("WSD endpoint must resolve to a local IP address")
    val address = try {
      if (isV4) InetAddress.getByAddress(ipv4Parts.map { it.toInt().toByte() }.toByteArray()) else InetAddress.getByName(host)
    } catch (error: Throwable) { throw IllegalArgumentException("Cannot resolve local WSD scanner address: $host", error) }
    val ip = address.hostAddress?.substringBefore('%') ?: throw IllegalArgumentException("WSD endpoint has no IP address")
    val privateV4 = ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.") || Regex("^172\\.(1[6-9]|2[0-9]|3[01])\\.").containsMatchIn(ip)
    val localV6 = address.isLinkLocalAddress || address.isSiteLocalAddress || ip.startsWith("fc", true) || ip.startsWith("fd", true)
    if (!privateV4 && !localV6) throw IllegalArgumentException("The WSD endpoint is not on a private local network")
    return url.toExternalForm()
  }

  private fun parseXml(bytes: ByteArray): Document {
    // WSD/SOAP messages never carry a DTD. Android's DOM parser does not support the Xerces
    // "disallow-doctype-decl" feature (it throws), so DTDs/entities are rejected up front instead.
    val head = String(bytes, Charsets.ISO_8859_1)
    if (head.contains("<!DOCTYPE", true) || head.contains("<!ENTITY", true)) {
      throw IllegalArgumentException("XML with a DTD or entity declaration is not accepted")
    }
    val factory = DocumentBuilderFactory.newInstance().apply {
      isNamespaceAware = true
      // Best-effort hardening only: unsupported features must not make discovery fail.
      for (feature in listOf(
        "http://xml.org/sax/features/external-general-entities",
        "http://xml.org/sax/features/external-parameter-entities",
      )) {
        try { setFeature(feature, false) } catch (_: Throwable) { }
      }
      try { setExpandEntityReferences(false) } catch (_: Throwable) { }
    }
    return factory.newDocumentBuilder().parse(bytes.inputStream())
  }

  private fun findText(node: Node, localName: String): String? = findTexts(node, localName).firstOrNull()

  private fun parseServiceTypes(match: Node): List<Pair<String, String>> = findElements(match, "Types").flatMap { typesNode ->
    val element = typesNode as? org.w3c.dom.Element ?: return@flatMap emptyList()
    (typesNode.textContent ?: "").trim().split(Regex("\\s+")).mapNotNull { qName ->
      val separator = qName.indexOf(':')
      val prefix = if (separator > 0) qName.substring(0, separator) else null
      val localName = if (separator > 0) qName.substring(separator + 1) else qName
      val namespace = element.lookupNamespaceURI(prefix)
      if (localName.isBlank() || namespace.isNullOrBlank()) null else namespace to localName
    }
  }

  private fun findElements(node: Node, localName: String): List<Node> {
    val found = mutableListOf<Node>()
    fun walk(current: Node) {
      if (current.nodeType == Node.ELEMENT_NODE && (current.localName ?: current.nodeName.substringAfter(':')) == localName) {
        found.add(current)
      }
      val children = current.childNodes
      for (i in 0 until children.length) walk(children.item(i))
    }
    walk(node)
    return found
  }

  private fun findTexts(node: Node, localName: String): List<String> {
    val found = mutableListOf<String>()
    fun walk(current: Node) {
      if (current.nodeType == Node.ELEMENT_NODE && (current.localName ?: current.nodeName.substringAfter(':')) == localName) {
        val value = current.textContent?.trim()
        if (!value.isNullOrEmpty()) found.add(value)
      }
      val children = current.childNodes
      for (i in 0 until children.length) walk(children.item(i))
    }
    walk(node)
    return found
  }

  private fun scannerFault(doc: Document): String? {
    val reason = findText(doc, "Text") ?: findText(doc, "Reason")
    val code = findText(doc, "Subcode") ?: findText(doc, "Value")
    return listOfNotNull(reason, code?.takeIf { !it.contains("Sender") && !it.contains("Receiver") }).joinToString(" — ").ifBlank { null }
  }

  private fun xmlEscape(value: String): String = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")
}
