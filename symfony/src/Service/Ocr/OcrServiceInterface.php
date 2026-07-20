<?php

namespace App\Service\Ocr;

use Symfony\Component\HttpFoundation\File\UploadedFile;

interface OcrServiceInterface
{
    /**
     * Extracts the total amount from a receipt image.
     * Returns the amount as a string (e.g. "12.34") or null if not found.
     */
    public function extractTotal(UploadedFile $file): ?string;
}
